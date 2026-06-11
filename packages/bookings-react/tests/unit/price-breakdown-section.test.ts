import { describe, expect, it } from "vitest"

import { createUnitPriceLookup } from "../../src/components/price-breakdown-section.js"

describe("price breakdown unit price lookup", () => {
  it("does not reuse another pricing category row as a fallback", () => {
    const findUnitPrice = createUnitPriceLookup([
      {
        unitId: "optu_double",
        pricingCategoryId: "pcat_adult",
        sellAmountCents: 48_000,
      },
    ])

    expect(findUnitPrice("optu_double", "pcat_child")).toBeUndefined()
  })

  it("falls back to an uncategorized unit row when a selected category has no row", () => {
    const defaultRow = {
      unitId: "optu_double",
      pricingCategoryId: null,
      sellAmountCents: 40_000,
    }
    const findUnitPrice = createUnitPriceLookup([
      defaultRow,
      {
        unitId: "optu_double",
        pricingCategoryId: "pcat_adult",
        sellAmountCents: 48_000,
      },
    ])

    expect(findUnitPrice("optu_double", "pcat_child")).toBe(defaultRow)
  })
})
