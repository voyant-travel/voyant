/**
 * Operator-configurable cost categories: lazy default seed + CRUD/archive.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { costCategoriesService } from "../../src/service-cost-categories.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("cost categories", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })
  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })
  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  it("lazily seeds defaults on first list, then is idempotent", async () => {
    const first = await costCategoriesService.list(db)
    expect(first.map((c) => c.name)).toEqual([
      "Transportation",
      "Accommodation",
      "Guides / touristic services",
      "Other",
    ])
    const second = await costCategoriesService.list(db)
    expect(second).toHaveLength(4) // no duplicate seeding
  })

  it("creates, renames and archives categories", async () => {
    await costCategoriesService.list(db) // seed
    const created = await costCategoriesService.create(db, { name: "Flights", sortOrder: 10 })
    expect(created.name).toBe("Flights")

    const renamed = await costCategoriesService.update(db, created.id, { name: "Air travel" })
    expect(renamed?.name).toBe("Air travel")

    await costCategoriesService.update(db, created.id, { archived: true })
    const active = await costCategoriesService.list(db)
    expect(active.find((c) => c.id === created.id)).toBeUndefined()
    const all = await costCategoriesService.list(db, { includeArchived: true })
    expect(all.find((c) => c.id === created.id)?.archived).toBe(true)
  })
})
