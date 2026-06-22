import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { facilities } from "../../../src/places/schema.js"
import { functionSpaceService } from "../../../src/places/service-function-spaces.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("function-space service", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedVenue() {
    const [facility] = await db
      .insert(facilities)
      .values({ kind: "venue", name: "Test Convention Centre" })
      .returning()
    if (!facility) throw new Error("seed facility failed")
    return facility
  }

  it("returns facility_not_found for a stale facilityId (no FK 500)", async () => {
    const outcome = await functionSpaceService.createFunctionSpace(db, {
      facilityId: "fac_does_not_exist",
      name: "Ballroom",
    })
    expect(outcome.status).toBe("facility_not_found")
  })

  it("returns parent_not_found for a stale parentSpaceId", async () => {
    const facility = await seedVenue()
    const outcome = await functionSpaceService.createFunctionSpace(db, {
      facilityId: facility.id,
      name: "Breakout A",
      parentSpaceId: "fnsp_nope",
    })
    expect(outcome.status).toBe("parent_not_found")
  })

  it("creates a space under a valid facility", async () => {
    const facility = await seedVenue()
    const outcome = await functionSpaceService.createFunctionSpace(db, {
      facilityId: facility.id,
      name: "Grand Ballroom",
      divisible: true,
    })
    expect(outcome.status).toBe("ok")
  })

  it("replaces the capacity matrix, deleting omitted layouts", async () => {
    const facility = await seedVenue()
    const created = await functionSpaceService.createFunctionSpace(db, {
      facilityId: facility.id,
      name: "Grand Ballroom",
    })
    if (created.status !== "ok") throw new Error("create failed")
    const spaceId = created.space.id

    await functionSpaceService.setFunctionSpaceCapacities(db, spaceId, [
      { layout: "theater", capacity: 300 },
      { layout: "banquet", capacity: 180 },
    ])
    let space = await functionSpaceService.getFunctionSpace(db, spaceId)
    expect(space?.capacities.map((c) => c.layout).sort()).toEqual(["banquet", "theater"])

    // Replace with only theater — banquet must be removed.
    await functionSpaceService.setFunctionSpaceCapacities(db, spaceId, [
      { layout: "theater", capacity: 320 },
    ])
    space = await functionSpaceService.getFunctionSpace(db, spaceId)
    expect(space?.capacities).toHaveLength(1)
    expect(space?.capacities[0]?.layout).toBe("theater")
    expect(space?.capacities[0]?.capacity).toBe(320)

    // Empty payload clears all.
    await functionSpaceService.setFunctionSpaceCapacities(db, spaceId, [])
    space = await functionSpaceService.getFunctionSpace(db, spaceId)
    expect(space?.capacities).toHaveLength(0)
  })
})
