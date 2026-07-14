import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { createBookingTaxRoutes } from "../../src/booking-tax.js"
import { createFinanceHonoModule } from "../../src/index.js"

const document = JSON.parse(
  readFileSync(new URL("../../openapi/admin/booking-tax.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>> }

const openApiOptions = {
  openapi: "3.1.0" as const,
  info: {
    title: "Voyant Operator API",
    version: "0.0.0",
    description: "Generated from the composed operator app. Do not edit by hand.",
  },
  servers: [{ url: "/", description: "This deployment (same origin)" }],
}

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

describe("Travel Credit OpenAPI ownership", () => {
  const financeModule = createFinanceHonoModule()
  const adminLive = financeModule.adminRoutes.getOpenAPI31Document(openApiOptions)
  const storefrontLive = financeModule.publicRoutes.getOpenAPI31Document(openApiOptions)
  const adminCommitted = JSON.parse(
    readFileSync(new URL("../../openapi/admin/finance.json", import.meta.url), "utf8"),
  )
  const storefrontCommitted = JSON.parse(
    readFileSync(new URL("../../openapi/storefront/finance.json", import.meta.url), "utf8"),
  )

  it.each([
    ["/travel-credits", "/v1/admin/finance/travel-credits"],
    ["/travel-credits/{id}", "/v1/admin/finance/travel-credits/{id}"],
    ["/travel-credits/{id}/redeem", "/v1/admin/finance/travel-credits/{id}/redeem"],
  ])("keeps the admin %s schema in sync", (livePath, committedPath) => {
    expect(adminCommitted.paths[committedPath]).toEqual(
      withCompositionMetadata(adminLive.paths[livePath], adminCommitted.paths[committedPath]),
    )
  })

  it("keeps the public validation schema in sync", () => {
    const committedPath = storefrontCommitted.paths["/v1/public/finance/travel-credits/validate"]
    expect(committedPath).toEqual(
      withCompositionMetadata(storefrontLive.paths["/travel-credits/validate"], committedPath),
    )
  })

  it("does not publish the former Finance voucher paths", () => {
    expect(Object.keys(adminCommitted.paths)).not.toContain(
      expect.stringContaining("/finance/vouchers"),
    )
    expect(Object.keys(storefrontCommitted.paths)).not.toContain(
      expect.stringContaining("/finance/vouchers"),
    )
  })
})

function withCompositionMetadata(livePath: unknown, committedPath: unknown) {
  const live = structuredClone(livePath) as Record<string, Record<string, unknown>>
  const committed = committedPath as Record<string, Record<string, unknown>>
  for (const [method, operation] of Object.entries(live)) {
    for (const key of ["operationId", "summary", "tags", "x-voyant-module", "x-voyant-surface"]) {
      if (committed[method]?.[key] !== undefined) {
        operation[key] = structuredClone(committed[method][key])
      }
    }
  }
  return live
}
