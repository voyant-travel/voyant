import { createFieldPolicyRegistry } from "@voyantjs/catalog/contract"
import { describe, expect, it } from "vitest"

import { cruiseCatalogPolicy } from "../../src/catalog-policy.js"

describe("cruiseCatalogPolicy", () => {
  it("compiles into a valid registry without errors", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    expect(registry.policies.length).toBeGreaterThan(0)
  })

  it("declares the three provenance fields", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    expect(registry.byPath.has("source.kind")).toBe(true)
    expect(registry.byPath.has("source.ref")).toBe(true)
    expect(registry.byPath.has("seller.operator_id")).toBe(true)
  })

  it("classifies cruise marketing copy as merchandisable + localized", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    const name = registry.byPath.get("name")
    expect(name?.class).toBe("merchandisable")
    expect(name?.localized).toBe(true)
    const description = registry.byPath.get("description")
    expect(description?.localized).toBe(true)
    const inclusions = registry.byPath.get("inclusionsHtml")
    expect(inclusions?.localized).toBe(true)
  })

  it("treats cruiseType, status, nights, ports as facet-affecting structural", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    expect(registry.byPath.get("cruiseType")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("nights")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("embarkPortFacilityId")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("embarkPortCanonicalPlaceId")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("disembarkPortFacilityId")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("disembarkPortCanonicalPlaceId")?.reindex).toBe("facet-affecting")
  })

  it("classifies cached price/departure summaries as volatile-indexed (Tier 1)", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    expect(registry.byPath.get("lowestPriceCached")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("lowestPriceCurrencyCached")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("earliestDepartureCached")?.class).toBe("volatile-indexed")
    expect(registry.byPath.get("latestDepartureCached")?.class).toBe("volatile-indexed")
  })

  it("requires confirmation when ops edits regions/themes (override friction)", () => {
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    expect(registry.byPath.get("regions[]")?.overrideFriction).toBe("confirm")
    expect(registry.byPath.get("themes[]")?.overrideFriction).toBe("confirm")
  })
})
