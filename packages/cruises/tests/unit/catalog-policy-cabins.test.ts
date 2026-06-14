import { createFieldPolicyRegistry } from "@voyant-travel/catalog/contract"
import { describe, expect, it } from "vitest"

import { cruiseCatalogPolicy } from "../../src/catalog-policy.js"
import {
  CRUISE_CABIN_CATEGORY_FIELD_POLICY,
  CRUISE_CABIN_FACETS_FIELD_POLICY,
  CRUISE_DECK_FIELD_POLICY,
  cruiseCabinCategoryCatalogPolicy,
  cruiseCabinFacetsCatalogPolicy,
  cruiseDeckCatalogPolicy,
} from "../../src/catalog-policy-cabins.js"

describe("cruise cabin/deck catalog policies", () => {
  it("declares root cruise cabin and deck facet paths", () => {
    const paths = CRUISE_CABIN_FACETS_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("cabinRoomTypes[]")
    expect(paths).toContain("cabinFeatureCodes[]")
    expect(paths).toContain("cabinBedConfigurations[]")
    expect(paths).toContain("cabinAccessibilityFeatures[]")
    expect(paths).toContain("cabinViewTypes[]")
    expect(paths).toContain("deckNames[]")
    expect(paths).toContain("deckLevels[]")
  })

  it("marks root cabin/deck facets as facet-affecting", () => {
    const registry = createFieldPolicyRegistry([
      ...cruiseCatalogPolicy,
      ...cruiseCabinFacetsCatalogPolicy,
    ])
    expect(registry.byPath.get("cabinRoomTypes[]")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("cabinFeatureCodes[]")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("cabinBedConfigurations[]")?.query).toBe("indexed-column")
    expect(registry.byPath.get("deckLevels[]")?.query).toBe("indexed-column")
  })

  it("declares structured cabin category feature fields", () => {
    const paths = CRUISE_CABIN_CATEGORY_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("featureCodes[]")
    expect(paths).toContain("bedConfigurations[]")
    expect(paths).toContain("accessibilityFeatures[]")
    expect(paths).toContain("viewType")

    const registry = createFieldPolicyRegistry(cruiseCabinCategoryCatalogPolicy)
    expect(registry.byPath.get("roomType")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("bedConfigurations[]")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("accessibilityFeatures[]")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("viewType")?.reindex).toBe("facet-affecting")
  })

  it("declares deck child entity facets separately from cabin categories", () => {
    const paths = CRUISE_DECK_FIELD_POLICY.map((p) => p.path)
    expect(paths).toContain("shipId")
    expect(paths).toContain("name")
    expect(paths).toContain("level")

    const registry = createFieldPolicyRegistry(cruiseDeckCatalogPolicy)
    expect(registry.byPath.get("level")?.reindex).toBe("facet-affecting")
    expect(registry.byPath.get("name")?.localized).toBe(true)
  })
})
