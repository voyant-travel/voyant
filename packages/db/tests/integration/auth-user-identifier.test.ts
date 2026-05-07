/**
 * Verifies the auth.user identifier rules introduced in #441:
 *
 *  - `email` is nullable (phone-only signups have no email).
 *  - `phone_number` is the second identifier and is independently
 *    unique among non-null rows.
 *  - The `user_email_or_phone` check constraint rejects rows where
 *    both identifiers are null.
 *  - The partial unique indexes allow many phone-only or many
 *    email-only users to coexist while still rejecting duplicates of
 *    each non-null identifier.
 *
 * Skipped without `TEST_DATABASE_URL`. The test runs raw SQL because
 * the goal is to assert PG-level constraint behaviour, not Drizzle's
 * insert ergonomics.
 */
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createTestDb } from "../../src/test-utils.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

describe.skipIf(!DB_AVAILABLE)("auth.user email-or-phone constraints", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    db = createTestDb()
  })

  beforeEach(async () => {
    // The `user` table is shared across many tests; clean only the
    // rows we insert here to stay polite.
    await db.execute(sql`DELETE FROM "user" WHERE "id" LIKE 'authuser_test_%'`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM "user" WHERE "id" LIKE 'authuser_test_%'`)
  })

  async function insertUser(values: {
    id: string
    email?: string | null
    phoneNumber?: string | null
    name?: string
  }) {
    return db.execute(sql`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "phone_number", "phone_number_verified", "created_at", "updated_at")
      VALUES (
        ${values.id},
        ${values.name ?? "Test User"},
        ${values.email ?? null},
        ${false},
        ${values.phoneNumber ?? null},
        ${false},
        now(),
        now()
      )
    `)
  }

  it("accepts a phone-only user (email NULL)", async () => {
    await expect(
      insertUser({ id: "authuser_test_phone1", phoneNumber: "+40700000001" }),
    ).resolves.not.toThrow()
  })

  it("accepts an email-only user (phone NULL)", async () => {
    await expect(
      insertUser({ id: "authuser_test_email1", email: "test441-1@example.com" }),
    ).resolves.not.toThrow()
  })

  it("rejects a row with both email and phone NULL", async () => {
    await expect(insertUser({ id: "authuser_test_neither" })).rejects.toThrow(/user_email_or_phone/)
  })

  it("enforces email uniqueness only among non-null emails", async () => {
    await insertUser({ id: "authuser_test_email2", email: "test441-dup@example.com" })
    await expect(
      insertUser({ id: "authuser_test_email3", email: "test441-dup@example.com" }),
    ).rejects.toThrow(/user_email_unique/)
    // A phone-only row alongside an email-only row is fine.
    await expect(
      insertUser({ id: "authuser_test_phone2", phoneNumber: "+40700000002" }),
    ).resolves.not.toThrow()
  })

  it("enforces phone uniqueness only among non-null phones", async () => {
    await insertUser({ id: "authuser_test_phone3", phoneNumber: "+40700000003" })
    await expect(
      insertUser({ id: "authuser_test_phone4", phoneNumber: "+40700000003" }),
    ).rejects.toThrow(/user_phone_unique/)
  })

  it("allows the same row to set both email and phone", async () => {
    await expect(
      insertUser({
        id: "authuser_test_both",
        email: "test441-both@example.com",
        phoneNumber: "+40700000099",
      }),
    ).resolves.not.toThrow()
  })
})
