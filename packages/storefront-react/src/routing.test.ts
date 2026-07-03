import { describe, expect, it } from "vitest"

import {
  getStorefrontCustomerProductDetailRoute,
  isStorefrontCustomerBookableProductVertical,
  storefrontCustomerBookableProductVerticals,
} from "./routing.js"

describe("storefront customer product routing", () => {
  it("keeps the customer detail route limited to implemented booking verticals", () => {
    expect(storefrontCustomerBookableProductVerticals).toEqual([
      "products",
      "accommodations",
      "cruises",
    ])
  })

  it("treats charters as searchable but not customer-bookable through product detail", () => {
    expect(isStorefrontCustomerBookableProductVertical("charters")).toBe(false)
    expect(getStorefrontCustomerProductDetailRoute("charters", "chrt_123")).toBeNull()
  })

  it("routes cruises to customer-bookable product detail", () => {
    expect(isStorefrontCustomerBookableProductVertical("cruises")).toBe(true)
    expect(getStorefrontCustomerProductDetailRoute("cruises", "cru_123")).toEqual({
      to: "/shop/products/$entityModule/$entityId",
      params: { entityModule: "cruises", entityId: "cru_123" },
    })
  })

  it("does not route sourced cruise projections to customer booking detail yet", () => {
    expect(getStorefrontCustomerProductDetailRoute("cruises", "crus_sr_123")).toBeNull()
    expect(getStorefrontCustomerProductDetailRoute("cruises", "crus_external")).toBeNull()
  })

  it("builds route params for implemented storefront booking detail pages", () => {
    expect(getStorefrontCustomerProductDetailRoute("products", "prod_123")).toEqual({
      to: "/shop/products/$entityModule/$entityId",
      params: { entityModule: "products", entityId: "prod_123" },
    })
  })
})
