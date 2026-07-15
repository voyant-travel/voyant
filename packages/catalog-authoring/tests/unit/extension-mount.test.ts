import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { catalogAuthoringExtension } from "../../src/extension.js"
import { productGraphSpecSchema } from "../../src/spec.js"

/**
 * Proves the Option-B mounting mechanism: registered as a ApiExtension whose
 * `module` is "products", the routes resolve under `/v1/admin/products/...`
 * exactly as `createApp` mounts extensions (`packages/hono/src/app.ts`:
 * `app.route('/v1/admin/' + ext.extension.module, ext.adminRoutes)`).
 */
describe("catalogAuthoringExtension mounting", () => {
  it("targets the products module prefix", () => {
    expect(catalogAuthoringExtension.extension.module).toBe("products")
    expect(catalogAuthoringExtension.adminRoutes).toBeDefined()
  })

  // Replicate createApp's extension mount expression verbatim.
  const app = new Hono().route(
    `/v1/admin/${catalogAuthoringExtension.extension.module}`,
    catalogAuthoringExtension.adminRoutes ?? new Hono(),
  )

  // With no db/body wired, the handlers error out — but a matched route never
  // 404s, which is what proves the mount path. (Full behaviour is covered by the
  // route integration tests.)
  it("resolves POST /v1/admin/products/compose (route matched, not 404)", async () => {
    const res = await app.request("/v1/admin/products/compose", { method: "POST" })
    expect(res.status).not.toBe(404)
  })

  it("resolves POST /v1/admin/products/:id/duplicate (route matched, not 404)", async () => {
    const res = await app.request("/v1/admin/products/prod_123/duplicate", { method: "POST" })
    expect(res.status).not.toBe(404)
  })

  it("does not swallow unrelated product paths", async () => {
    const res = await app.request("/v1/admin/products/prod_123/unmounted", { method: "GET" })
    expect(res.status).toBe(404)
  })
})

describe("productGraphSpecSchema", () => {
  it("parses a minimal single-day excursion spec and applies defaults", () => {
    const parsed = productGraphSpecSchema.parse({
      product: { name: "City Walk", sellCurrency: "RON" },
      options: [
        {
          ref: "opt-1",
          name: "Standard",
          units: [{ ref: "u-adult", name: "Adult" }],
          priceRules: [
            {
              name: "Base",
              unitPriceRules: [{ unitRef: "u-adult", sellAmountCents: 12000 }],
            },
          ],
        },
      ],
    })

    expect(parsed.product.bookingMode).toBe("date")
    expect(parsed.product.status).toBe("draft")
    expect(parsed.options[0]?.units[0]?.unitType).toBe("person")
    expect(parsed.options[0]?.priceRules[0]?.pricingMode).toBe("per_person")
    expect(parsed.itineraries).toEqual([])
    expect(parsed.paxPricingTiers).toEqual([])
  })

  it("rejects a unit price rule with no unitRef", () => {
    const result = productGraphSpecSchema.safeParse({
      product: { name: "X", sellCurrency: "RON" },
      options: [
        {
          ref: "o",
          name: "o",
          units: [],
          priceRules: [{ name: "r", unitPriceRules: [{ sellAmountCents: 1 }] }],
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})
