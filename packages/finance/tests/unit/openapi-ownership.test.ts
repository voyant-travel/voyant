import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const document = JSON.parse(
  readFileSync(new URL("../../openapi/admin/booking-tax.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>> }

describe("booking tax OpenAPI ownership", () => {
  it("claims every booking tax operation", () => {
    const apiId = "@voyant-travel/finance#booking-tax-extension.api"
    const operations = [
      document.paths["/v1/admin/bookings/tax-settings"]?.get,
      document.paths["/v1/admin/bookings/tax-settings"]?.patch,
      document.paths["/v1/admin/bookings/tax-preview"]?.post,
    ]

    expect(operations.every((operation) => operation?.["x-voyant-api-id"] === apiId)).toBe(true)
  })
})
