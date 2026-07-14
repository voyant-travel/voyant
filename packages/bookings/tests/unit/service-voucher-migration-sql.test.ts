import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("../../migrations/0001_service_voucher_vocabulary.sql", import.meta.url),
  "utf8",
)

describe("Service Voucher migration", () => {
  it("renames the persisted fulfillment enum value in place", () => {
    expect(sql).toContain(
      `ALTER TYPE "public"."booking_fulfillment_type" RENAME VALUE 'voucher' TO 'service_voucher'`,
    )
    expect(sql).not.toContain("DROP TYPE")
  })
})
