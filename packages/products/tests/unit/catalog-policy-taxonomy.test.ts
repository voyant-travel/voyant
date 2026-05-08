import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { productCatalogPolicy } from "../../src/catalog-policy.js"
import { productDestinationsCatalogPolicy } from "../../src/catalog-policy-destinations.js"
import {
  PRODUCT_TAXONOMY_FIELD_POLICY,
  productTaxonomyCatalogPolicy,
} from "../../src/catalog-policy-taxonomy.js"

describe("productTaxonomyCatalogPolicy", () => {
  it("declares the storefront-required taxonomy paths", () => {
    const paths = PRODUCT_TAXONOMY_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("categories[]")
    expect(paths).toContain("categoryIds[]")
    expect(paths).toContain("categorySlugs[]")
    expect(paths).toContain("primaryCategoryId")
    expect(paths).toContain("primaryCategoryName")
    expect(paths).toContain("primaryCategorySlug")
    expect(paths).toContain("tagLabels[]")
    expect(paths).toContain("tagIds[]")
  })

  it("does not declare any locale-keyed fields (today's schema is single-name)", () => {
    // Localization is deferred — the schema has no category/tag translation
    // tables yet. Asserting `localized: false` everywhere guards against an
    // accidental flip that would silently emit the same name on every locale
    // slice while telling the indexer it's locale-keyed.
    for (const policy of PRODUCT_TAXONOMY_FIELD_POLICY) {
      expect(policy.localized).toBe(false)
    }
  })

  it("does not collide with the base catalog-policy `tags[]` path", () => {
    // The base policy already projects `products.tags` (free-form text[]).
    // Structured taxonomy lands on `tagLabels[]` to avoid colliding.
    const taxonomyPaths = new Set(PRODUCT_TAXONOMY_FIELD_POLICY.map((p) => p.path))
    expect(taxonomyPaths.has("tags[]")).toBe(false)
  })

  it("makes every field visible to staff/customer/partner so storefront cards can render", () => {
    for (const policy of PRODUCT_TAXONOMY_FIELD_POLICY) {
      expect(policy.visibility).toContain("customer")
      expect(policy.visibility).toContain("partner")
      expect(policy.visibility).toContain("staff")
    }
  })

  it("composes cleanly with productCatalogPolicy + productDestinationsCatalogPolicy", () => {
    const registry = createFieldPolicyRegistry([
      ...productCatalogPolicy,
      ...productDestinationsCatalogPolicy,
      ...productTaxonomyCatalogPolicy,
    ])
    expect(registry.resolve("name")).toBeDefined()
    expect(registry.resolve("regions[]")).toBeDefined()
    expect(registry.resolve("categories[]")).toBeDefined()
    expect(registry.resolve("primaryCategoryId")).toBeDefined()
    expect(registry.resolve("tagLabels[]")).toBeDefined()
  })

  it("does not duplicate any path against the base or destinations policies", () => {
    expect(() =>
      createFieldPolicyRegistry([
        ...productCatalogPolicy,
        ...productDestinationsCatalogPolicy,
        ...productTaxonomyCatalogPolicy,
      ]),
    ).not.toThrow()
  })
})
