import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { productCatalogPolicy } from "../../src/catalog-policy.js"
import { productDeparturesCatalogPolicy } from "../../src/catalog-policy-departures.js"
import { productDestinationsCatalogPolicy } from "../../src/catalog-policy-destinations.js"
import {
  PRODUCT_PRICING_FIELD_POLICY,
  productPricingCatalogPolicy,
} from "../../src/catalog-policy-pricing.js"
import { productTaxonomyCatalogPolicy } from "../../src/catalog-policy-taxonomy.js"

describe("productPricingCatalogPolicy", () => {
  it("declares the storefront-required price-from paths", () => {
    const paths = PRODUCT_PRICING_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("priceFromAmountCents")
    expect(paths).toContain("priceFromCurrency")
    expect(paths).toContain("hasPricing")
  })

  it("does not collide with the base policy's existing sellAmountCents/sellCurrency paths", () => {
    // The base policy already projects sellAmountCents + sellCurrency
    // verbatim from the products row. Pricing policy uses different
    // names so the two coexist (priceFrom is the multi-option MIN
    // aggregate, sellAmount is the row default).
    const pricingPaths = new Set(PRODUCT_PRICING_FIELD_POLICY.map((p) => p.path))
    expect(pricingPaths.has("sellAmountCents")).toBe(false)
    expect(pricingPaths.has("sellCurrency")).toBe(false)
  })

  it("makes every field visible to staff/customer/partner so storefront cards can render", () => {
    for (const policy of PRODUCT_PRICING_FIELD_POLICY) {
      expect(policy.visibility).toContain("customer")
      expect(policy.visibility).toContain("partner")
      expect(policy.visibility).toContain("staff")
    }
  })

  it("composes cleanly with all other product child-entity policies", () => {
    const registry = createFieldPolicyRegistry([
      ...productCatalogPolicy,
      ...productDestinationsCatalogPolicy,
      ...productTaxonomyCatalogPolicy,
      ...productDeparturesCatalogPolicy,
      ...productPricingCatalogPolicy,
    ])
    expect(registry.resolve("name")).toBeDefined()
    expect(registry.resolve("regions[]")).toBeDefined()
    expect(registry.resolve("categories[]")).toBeDefined()
    expect(registry.resolve("nextDepartureAt")).toBeDefined()
    expect(registry.resolve("priceFromAmountCents")).toBeDefined()
    expect(registry.resolve("priceFromCurrency")).toBeDefined()
    expect(registry.resolve("hasPricing")).toBeDefined()
  })

  it("does not duplicate any path against base or sibling child-entity policies", () => {
    expect(() =>
      createFieldPolicyRegistry([
        ...productCatalogPolicy,
        ...productDestinationsCatalogPolicy,
        ...productTaxonomyCatalogPolicy,
        ...productDeparturesCatalogPolicy,
        ...productPricingCatalogPolicy,
      ]),
    ).not.toThrow()
  })
})
