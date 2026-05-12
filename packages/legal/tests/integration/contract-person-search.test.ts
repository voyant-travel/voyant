import { people } from "@voyantjs/crm/schema"
import { newId } from "@voyantjs/db/lib/typeid"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { contracts } from "../../src/contracts/schema.js"
import { contractRecordsService } from "../../src/contracts/service-contracts.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("contractRecordsService person search", () => {
  let db: PostgresJsDatabase

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

  it("matches related person fields and returns hydrated person details", async () => {
    const [person] = await db
      .insert(people)
      .values({
        firstName: "Ana",
        lastName: "Ionescu",
        status: "active",
        tags: [],
      })
      .returning()
    expect(person).toBeDefined()

    await db.execute(sql`
      INSERT INTO identity_contact_points (
        id,
        entity_type,
        entity_id,
        kind,
        label,
        value,
        normalized_value,
        is_primary
      )
      VALUES (
        ${newId("identity_contact_points")},
        'person',
        ${person!.id},
        'email',
        'primary',
        'ana.ionescu@example.com',
        'ana.ionescu@example.com',
        true
      )
    `)

    const [contract] = await db
      .insert(contracts)
      .values({
        scope: "customer",
        status: "draft",
        title: "Standard travel contract",
        personId: person!.id,
      })
      .returning()
    expect(contract).toBeDefined()

    const byName = await contractRecordsService.listContracts(db, {
      search: "Ionescu",
      limit: 10,
      offset: 0,
    })
    const byEmail = await contractRecordsService.listContracts(db, {
      search: "ana.ionescu@example.com",
      limit: 10,
      offset: 0,
    })
    const byFullName = await contractRecordsService.listContracts(db, {
      search: "Ana Ionescu",
      limit: 10,
      offset: 0,
    })

    expect(byName.data).toHaveLength(1)
    expect(byEmail.data).toHaveLength(1)
    expect(byFullName.data).toHaveLength(1)
    expect(byName.data[0]).toMatchObject({
      id: contract!.id,
      personId: person!.id,
      personFirstName: "Ana",
      personLastName: "Ionescu",
      personEmail: "ana.ionescu@example.com",
    })
  })
})
