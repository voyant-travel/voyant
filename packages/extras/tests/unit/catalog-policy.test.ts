import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { extrasCatalogPolicy } from "../../src/catalog-policy.js"

describe("extrasCatalogPolicy", () => {
  it("compiles into a valid registry without errors", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
  })

  it("declares the three provenance fields", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    expect(registry.byPath.has("source.kind")).toBe(true)
    expect(registry.byPath.has("source.ref")).toBe(true)
    expect(registry.byPath.has("seller.operator_id")).toBe(true)
  })

  it("partial adoption: every field has reindex='none' (no search index participation)", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    for (const policy of registry.policies) {
      expect(policy.reindex).toBe("none")
    }
  })

  it("partial adoption: no merchandisable fields (no overlay store participation)", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    for (const policy of registry.policies) {
      expect(policy.class).not.toBe("merchandisable")
    }
  })

  it("captures snapshot for every field that drives refunds (selectionType, pricingMode, etc.)", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    expect(registry.byPath.get("selectionType")?.snapshot).toBe("on-book")
    expect(registry.byPath.get("pricingMode")?.snapshot).toBe("on-quote-and-book")
    expect(registry.byPath.get("pricedPerPerson")?.snapshot).toBe("on-quote-and-book")
    expect(registry.byPath.get("name")?.snapshot).toBe("on-book")
  })

  it("classifies parent-product reference (productId) as managed-critical", () => {
    const registry = createFieldPolicyRegistry(extrasCatalogPolicy)
    const productId = registry.byPath.get("productId")
    expect(productId?.class).toBe("managed")
    expect(productId?.drift).toBe("critical")
  })
})
