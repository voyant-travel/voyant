import { people } from "@voyant-travel/relationships/schema"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { contracts } from "../../src/contracts/schema.js"
import { contractRecordsService } from "../../src/contracts/service-contracts.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

/**
 * With the hard cross-package FKs removed (module decoupling), the service-layer
 * existence check is the only guard keeping a contract's person/organization/
 * supplier references sound. These tests pin that behaviour.
 */
describe.skipIf(!DB_AVAILABLE)("contractRecordsService party validation", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("creates a contract when the personId exists", async () => {
    const [person] = await db
      .insert(people)
      .values({ firstName: "Ana", lastName: "Pop", status: "active", tags: [] })
      .returning()

    const row = await contractRecordsService.createContract(db, {
      scope: "customer",
      title: "Valid contract",
      personId: person!.id,
      // biome-ignore lint/suspicious/noExplicitAny: minimal insert fixture
    } as any)

    expect(row?.personId).toBe(person!.id)
  })

  it("rejects a contract referencing an unknown personId", async () => {
    await expect(
      contractRecordsService.createContract(db, {
        scope: "customer",
        title: "Bad contract",
        personId: "relationships_person_doesnotexist",
        // biome-ignore lint/suspicious/noExplicitAny: minimal insert fixture
      } as any),
    ).rejects.toThrow(/Unknown contract party/)
  })

  it("rejects an update that points organizationId at a missing organization", async () => {
    const [person] = await db
      .insert(people)
      .values({ firstName: "Ion", lastName: "Marin", status: "active", tags: [] })
      .returning()
    const created = await contractRecordsService.createContract(db, {
      scope: "customer",
      title: "Contract",
      personId: person!.id,
      // biome-ignore lint/suspicious/noExplicitAny: minimal insert fixture
    } as any)

    await expect(
      contractRecordsService.updateContract(db, created!.id, {
        organizationId: "relationships_organization_doesnotexist",
        // biome-ignore lint/suspicious/noExplicitAny: minimal update fixture
      } as any),
    ).rejects.toThrow(/Unknown contract party/)
  })

  it("rejects a signature referencing an unknown personId", async () => {
    const [contract] = await db
      .insert(contracts)
      .values({ scope: "customer", title: "Sendable", status: "sent" })
      .returning()

    await expect(
      contractRecordsService.signContract(db, contract!.id, {
        signerName: "Stranger",
        personId: "relationships_person_doesnotexist",
        // biome-ignore lint/suspicious/noExplicitAny: minimal signature fixture
      } as any),
    ).rejects.toThrow(/Unknown contract party/)
  })
})
