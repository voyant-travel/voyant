import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { createBookingTaxRoutes } from "../../src/booking-tax.js"
import { createFinanceHonoModule } from "../../src/index.js"

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

  it("stamps the same ownership on the live route registry", () => {
    const live = createBookingTaxRoutes().getOpenAPIDocument({
      info: { title: "test", version: "1" },
    })
    const apiId = "@voyant-travel/finance#booking-tax-extension.api"
    const operations = [
      live.paths?.["/tax-settings"]?.get,
      live.paths?.["/tax-settings"]?.patch,
      live.paths?.["/tax-preview"]?.post,
    ]

    expect(operations.every((operation) => operation?.["x-voyant-api-id"] === apiId)).toBe(true)
  })

  it("stamps base Finance routes without overwriting extension ownership", () => {
    const routes = createFinanceHonoModule().adminRoutes as ReturnType<
      typeof createBookingTaxRoutes
    >
    const live = routes.getOpenAPIDocument({ info: { title: "test", version: "1" } })

    expect(live.paths?.["/payment-sessions"]?.get?.["x-voyant-api-id"]).toBe(
      "@voyant-travel/finance#api.admin",
    )
    expect(live.paths?.["/tax-settings"]?.get?.["x-voyant-api-id"]).toBe(
      "@voyant-travel/finance#booking-tax-extension.api",
    )
  })
})
