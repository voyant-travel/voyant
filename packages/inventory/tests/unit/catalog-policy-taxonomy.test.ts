import { createFieldPolicyRegistry } from "@voyant-travel/catalog/contract"
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

  it("declares the right locale boundary — names locale-keyed, ids/slugs single-locale", () => {
    // Per #502: name labels (`categories[]`, `primaryCategoryName`,
    // `tagLabels[]`) are locale-keyed and reindex per-locale. Ids stay
    // stable across locales. Slugs stay single-locale (one canonical URL
    // per category) — operators want stable URLs that don't shift when
    // translations are edited.
    const byPath = new Map(PRODUCT_TAXONOMY_FIELD_POLICY.map((p) => [p.path, p]))

    expect(byPath.get("categories[]")?.localized).toBe(true)
    expect(byPath.get("primaryCategoryName")?.localized).toBe(true)
    expect(byPath.get("tagLabels[]")?.localized).toBe(true)

    expect(byPath.get("categoryIds[]")?.localized).toBe(false)
    expect(byPath.get("categorySlugs[]")?.localized).toBe(false)
    expect(byPath.get("primaryCategoryId")?.localized).toBe(false)
    expect(byPath.get("primaryCategorySlug")?.localized).toBe(false)
    expect(byPath.get("tagIds[]")?.localized).toBe(false)
  })

  it("locale-keyed fields use entry-locale reindex axis (per-locale slices reindex independently)", () => {
    const byPath = new Map(PRODUCT_TAXONOMY_FIELD_POLICY.map((p) => [p.path, p]))
    expect(byPath.get("categories[]")?.reindex).toBe("entry-locale")
    expect(byPath.get("primaryCategoryName")?.reindex).toBe("entry-locale")
    expect(byPath.get("tagLabels[]")?.reindex).toBe("entry-locale")
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
