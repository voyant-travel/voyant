import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { productCatalogPolicy } from "../../src/catalog-policy.js"
import {
  PRODUCT_DESTINATIONS_FIELD_POLICY,
  productDestinationsCatalogPolicy,
} from "../../src/catalog-policy-destinations.js"

describe("productDestinationsCatalogPolicy", () => {
  it("declares the storefront-required destination paths", () => {
    const paths = PRODUCT_DESTINATIONS_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("regions[]")
    expect(paths).toContain("countries[]")
    expect(paths).toContain("cities[]")
    expect(paths).toContain("destinationSlugs[]")
    expect(paths).toContain("destinationIds[]")
  })

  it("marks locale-aware label fields as localized", () => {
    const localizedPaths = new Set(
      PRODUCT_DESTINATIONS_FIELD_POLICY.filter((p) => p.localized).map((p) => p.path),
    )
    expect(localizedPaths).toContain("regions[]")
    expect(localizedPaths).toContain("countries[]")
    expect(localizedPaths).toContain("cities[]")
    // Slugs and IDs are not locale-stable
    expect(localizedPaths).not.toContain("destinationSlugs[]")
    expect(localizedPaths).not.toContain("destinationIds[]")
  })

  it("makes every field visible to staff/customer/partner so storefront cards can render", () => {
    for (const policy of PRODUCT_DESTINATIONS_FIELD_POLICY) {
      expect(policy.visibility).toContain("customer")
      expect(policy.visibility).toContain("partner")
      expect(policy.visibility).toContain("staff")
    }
  })

  it("composes cleanly with productCatalogPolicy into a single registry", () => {
    const registry = createFieldPolicyRegistry([
      ...productCatalogPolicy,
      ...productDestinationsCatalogPolicy,
    ])
    // Both root and destination paths should resolve
    expect(registry.resolve("name")).toBeDefined()
    expect(registry.resolve("regions[]")).toBeDefined()
    expect(registry.resolve("countries[]")).toBeDefined()
    expect(registry.resolve("destinationSlugs[]")).toBeDefined()
  })

  it("does not duplicate any path against productCatalogPolicy", () => {
    // If we accidentally redeclare a root-policy path the registry would
    // throw, so this test guards against silent regressions.
    expect(() =>
      createFieldPolicyRegistry([...productCatalogPolicy, ...productDestinationsCatalogPolicy]),
    ).not.toThrow()
  })
})
