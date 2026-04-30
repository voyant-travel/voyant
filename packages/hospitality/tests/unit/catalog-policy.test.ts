import { createFieldPolicyRegistry } from "@voyantjs/voyant-catalog/contract"
import { describe, expect, it } from "vitest"

import { hospitalityCatalogPolicy } from "../../src/catalog-policy.js"

describe("hospitalityCatalogPolicy", () => {
  it("compiles into a valid registry without errors", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
  })

  it("declares the three provenance fields", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    expect(registry.byPath.has("source.kind")).toBe(true)
    expect(registry.byPath.has("source.ref")).toBe(true)
    expect(registry.byPath.has("seller.operator_id")).toBe(true)
  })

  it("declares the cross-module reference to the property facility", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    const propertyId = registry.byPath.get("propertyId")
    expect(propertyId?.class).toBe("structural")
    expect(propertyId?.reindex).toBe("facet-affecting")
    expect(propertyId?.drift).toBe("critical")
  })

  it("classifies room marketing copy as merchandisable + localized", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    expect(registry.byPath.get("name")?.localized).toBe(true)
    expect(registry.byPath.get("description")?.localized).toBe(true)
    expect(registry.byPath.get("accessibilityNotes")?.localized).toBe(true)
  })

  it("treats occupancy fields as facet-affecting structural", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    expect(registry.byPath.get("maxAdults")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("maxChildren")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("maxOccupancy")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("standardOccupancy")?.reindex).toBe("facet-affecting")
  })

  it("requires confirmation when ops edits accessibility notes", () => {
    const registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
    expect(registry.byPath.get("accessibilityNotes")?.overrideFriction).toBe("confirm")
  })
})
