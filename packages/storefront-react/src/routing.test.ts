import { describe, expect, it } from "vitest"

import {
  getStorefrontCustomerProductDetailRoute,
  isStorefrontCustomerBookableProductVertical,
  storefrontCustomerBookableProductVerticals,
} from "./routing.js"

describe("storefront customer product routing", () => {
  it("keeps the customer detail route limited to implemented booking verticals", () => {
    expect(storefrontCustomerBookableProductVerticals).toEqual(["products", "accommodations"])
  })

  it("treats charters as searchable but not customer-bookable through product detail", () => {
    expect(isStorefrontCustomerBookableProductVertical("charters")).toBe(false)
    expect(getStorefrontCustomerProductDetailRoute("charters", "chrt_123")).toBeNull()
  })

  it("excludes cruises from customer-bookable product detail (voyant#2639)", () => {
    // The public cruise content endpoint serves sourced cruises only, so owned
    // seeded cruises produced dead detail pages. Cruises stay searchable in the
    // catalog but must not link to the storefront customer detail route.
    expect(isStorefrontCustomerBookableProductVertical("cruises")).toBe(false)
    expect(getStorefrontCustomerProductDetailRoute("cruises", "cru_123")).toBeNull()
  })

  it("builds route params for implemented storefront booking detail pages", () => {
    expect(getStorefrontCustomerProductDetailRoute("products", "prod_123")).toEqual({
      to: "/shop/products/$entityModule/$entityId",
      params: { entityModule: "products", entityId: "prod_123" },
    })
  })
})
