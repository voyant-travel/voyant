import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("../../migrations/0001_travel_credits.sql", import.meta.url),
  "utf8",
)

describe("Travel Credit schema migration", () => {
  it("renames stored-value data in place", () => {
    expect(migration).toContain('ALTER TABLE "vouchers" RENAME TO "travel_credits"')
    expect(migration).toContain(
      'ALTER TABLE "voucher_redemptions" RENAME TO "travel_credit_redemptions"',
    )
    expect(migration).toContain('RENAME COLUMN "voucher_id" TO "travel_credit_id"')
    expect(migration).not.toMatch(/DROP TABLE\s+"(?:vouchers|voucher_redemptions)"/)
  })

  it("maps persisted enum values before casting to the new enums", () => {
    const instrumentUpdate = migration.indexOf(
      `SET "instrument_type" = 'travel_credit' WHERE "instrument_type" = 'voucher'`,
    )
    const instrumentCast = migration.indexOf('SET DATA TYPE "public"."payment_instrument_type"')
    const sourceUpdate = migration.indexOf(
      `SET "source_type" = 'promotion' WHERE "source_type" = 'promo'`,
    )
    const sourceCast = migration.indexOf('SET DATA TYPE "public"."travel_credit_source_type"')

    expect(instrumentUpdate).toBeGreaterThan(-1)
    expect(instrumentCast).toBeGreaterThan(instrumentUpdate)
    expect(sourceUpdate).toBeGreaterThan(-1)
    expect(sourceCast).toBeGreaterThan(sourceUpdate)
  })

  it("normalizes codes and adds replay-safe redemption keys", () => {
    const blankCodeGuard = migration.indexOf(`trim("code") = ''`)
    const collisionGuard = migration.indexOf(`GROUP BY lower(trim("code"))`)
    const codeNormalization = migration.indexOf(`SET "code" = upper(trim("code"))`)

    expect(blankCodeGuard).toBeGreaterThan(-1)
    expect(collisionGuard).toBeGreaterThan(blankCodeGuard)
    expect(codeNormalization).toBeGreaterThan(collisionGuard)
    expect(migration).toContain(`SET "code" = upper(trim("code"))`)
    expect(migration).toContain(
      `CREATE UNIQUE INDEX "uidx_travel_credits_code" ON "travel_credits" USING btree (lower("code"))`,
    )
    expect(migration).toContain(`ADD COLUMN "idempotency_key" text`)
    expect(migration).toContain(`"uidx_travel_credit_redemptions_idempotency"`)
  })
})
