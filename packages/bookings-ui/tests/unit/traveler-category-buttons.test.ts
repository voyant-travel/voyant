import { describe, expect, it } from "vitest"

import {
  getDynamicTravelerCategoryButtonState,
  getSelectableTravelerCategoryUnits,
  getStaticTravelerCategoryButtonState,
  shouldUseStaticTravelerCategoryFallback,
} from "../../src/components/traveler-category-buttons.js"

describe("traveler category button state", () => {
  it("treats the lead traveler as adult-active in the static fallback buttons", () => {
    expect(
      getStaticTravelerCategoryButtonState({ role: "lead", pricingUnitId: null }, "adult"),
    ).toEqual({
      active: true,
      nextRole: "lead",
      shouldUpdate: false,
    })
  })

  it("keeps non-adult static buttons inactive for the lead traveler", () => {
    expect(
      getStaticTravelerCategoryButtonState({ role: "lead", pricingUnitId: null }, "child"),
    ).toEqual({
      active: false,
      nextRole: "child",
      shouldUpdate: true,
    })
  })

  it("preserves the lead role when the assigned dynamic unit is adult-coded", () => {
    expect(
      getDynamicTravelerCategoryButtonState(
        { role: "lead", pricingUnitId: "optu_adult" },
        { unitId: "optu_adult", unitCode: "ADULT" },
      ),
    ).toEqual({
      active: true,
      nextRole: "lead",
      shouldUpdate: false,
    })
  })

  it("allows a lead traveler on a child unit to switch role when child is clicked", () => {
    expect(
      getDynamicTravelerCategoryButtonState(
        { role: "lead", pricingUnitId: "optu_child" },
        { unitId: "optu_child", unitCode: "CHILD" },
      ),
    ).toEqual({
      active: true,
      nextRole: "child",
      shouldUpdate: true,
    })
  })

  it("uses static role buttons for room-only product options", () => {
    const selectableUnits = getSelectableTravelerCategoryUnits([
      { unitType: "room" },
      { unitType: "room" },
      { unitType: "room" },
    ])

    expect(selectableUnits).toEqual([])
    expect(shouldUseStaticTravelerCategoryFallback(true, selectableUnits.length)).toBe(true)
  })

  it("keeps configured person units as dynamic category buttons", () => {
    const selectableUnits = getSelectableTravelerCategoryUnits([
      { unitType: "room" },
      { unitType: "person" },
      { unitType: "person" },
    ])

    expect(selectableUnits).toHaveLength(2)
    expect(shouldUseStaticTravelerCategoryFallback(true, selectableUnits.length)).toBe(false)
  })
})
