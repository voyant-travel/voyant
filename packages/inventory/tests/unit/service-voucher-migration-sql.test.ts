import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("../../migrations/0004_service_voucher_vocabulary.sql", import.meta.url),
  "utf8",
)

describe("Service Voucher migration", () => {
  it("renames persisted delivery vocabulary and settings in place", () => {
    expect(sql).toContain(
      `ALTER TYPE "public"."product_delivery_format" RENAME VALUE 'voucher' TO 'service_voucher'`,
    )
    expect(sql).toContain(
      `ALTER TYPE "public"."product_capability" RENAME VALUE 'voucher_required' TO 'service_voucher_required'`,
    )
    expect(sql).toContain(
      `ALTER TABLE "product_ticket_settings" RENAME COLUMN "voucher_message" TO "service_voucher_message"`,
    )
    expect(sql).not.toContain("DROP TYPE")
  })
})
