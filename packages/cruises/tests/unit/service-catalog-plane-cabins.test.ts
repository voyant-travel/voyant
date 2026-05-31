import { describe, expect, it } from "vitest"

import { cruiseCabinFacetsCatalogPolicy } from "../../src/catalog-policy-cabins.js"
import { createCruisesRegistry } from "../../src/service-catalog-plane.js"
import { projectCruiseCabinFacetRows } from "../../src/service-catalog-plane-cabins.js"

describe("projectCruiseCabinFacetRows", () => {
  it("deduplicates cabin category, structured feature, and deck facets", () => {
    const projection = projectCruiseCabinFacetRows([
      {
        cabinCategoryId: "crcc_bal",
        cabinCategoryCode: "BAL",
        roomType: "balcony",
        featureCodes: ["laundry", "minibar"],
        bedConfigurations: ["king", "convertible_twins"],
        accessibilityFeatures: ["step_free_access"],
        viewType: "balcony",
        gradeCodes: ["BA", "BB"],
        deckId: "crdk_7",
        deckName: "Deck 7",
        deckLevel: 7,
      },
      {
        cabinCategoryId: "crcc_bal",
        cabinCategoryCode: "BAL",
        roomType: "balcony",
        featureCodes: ["minibar"],
        bedConfigurations: ["king"],
        accessibilityFeatures: ["step_free_access", "roll_in_shower"],
        viewType: "balcony",
        gradeCodes: ["BB"],
        deckId: "crdk_8",
        deckName: "Deck 8",
        deckLevel: 8,
      },
    ])

    expect(projection.get("cabinCategoryIds[]")).toEqual(["crcc_bal"])
    expect(projection.get("cabinCategoryCodes[]")).toEqual(["BAL"])
    expect(projection.get("cabinRoomTypes[]")).toEqual(["balcony"])
    expect(projection.get("cabinFeatureCodes[]")).toEqual(["laundry", "minibar"])
    expect(projection.get("cabinBedConfigurations[]")).toEqual(["king", "convertible_twins"])
    expect(projection.get("cabinAccessibilityFeatures[]")).toEqual([
      "step_free_access",
      "roll_in_shower",
    ])
    expect(projection.get("cabinViewTypes[]")).toEqual(["balcony"])
    expect(projection.get("cabinGradeCodes[]")).toEqual(["BA", "BB"])
    expect(projection.get("deckIds[]")).toEqual(["crdk_7", "crdk_8"])
    expect(projection.get("deckNames[]")).toEqual(["Deck 7", "Deck 8"])
    expect(projection.get("deckLevels[]")).toEqual([7, 8])
  })

  it("composes the cabin facets policy with the root cruise registry", () => {
    const registry = createCruisesRegistry(cruiseCabinFacetsCatalogPolicy)
    expect(registry.resolve("name")).toBeDefined()
    expect(registry.resolve("cabinRoomTypes[]")).toBeDefined()
    expect(registry.resolve("deckLevels[]")).toBeDefined()
  })
})
