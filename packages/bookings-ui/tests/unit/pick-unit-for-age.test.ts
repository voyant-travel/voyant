import { describe, expect, it } from "vitest"

import { pickUnitForAge } from "../../src/components/booking-create-dialog.js"
import type { OptionUnitsStepperUnit } from "../../src/components/option-units-stepper-section.js"

function unit(
  partial: Partial<OptionUnitsStepperUnit> & Pick<OptionUnitsStepperUnit, "optionUnitId">,
): OptionUnitsStepperUnit {
  return {
    optionId: partial.optionId ?? "opto_day_tour",
    optionUnitId: partial.optionUnitId,
    unitName: partial.unitName ?? partial.optionUnitId,
    unitCode: partial.unitCode ?? null,
    minAge: partial.minAge ?? null,
    maxAge: partial.maxAge ?? null,
    unitType: partial.unitType ?? "person",
    occupancyMax: partial.occupancyMax ?? null,
    initial: partial.initial ?? null,
    reserved: partial.reserved ?? 0,
    remaining: partial.remaining ?? null,
  }
}

describe("pickUnitForAge — age-banded unit codes (issue #1262)", () => {
  // Day-tour product whose age bands are encoded in the unit codes
  // instead of bare ADULT/CHILD/INFANT. Reproduces the layout that
  // broke after #1241.
  const ageBandedUnits: OptionUnitsStepperUnit[] = [
    unit({ optionUnitId: "u_adult", unitCode: "adult", unitName: "Adult", minAge: 13 }),
    unit({
      optionUnitId: "u_child_6_12",
      unitCode: "child_6_12",
      unitName: "Child 6-12",
      minAge: 6,
      maxAge: 12,
    }),
    unit({
      optionUnitId: "u_child_0_5",
      unitCode: "child_0_5",
      unitName: "Child 0-5",
      minAge: 0,
      maxAge: 5,
    }),
  ]

  it("routes a roleHint=infant traveler with no DOB to the 0-5 band", () => {
    expect(pickUnitForAge(ageBandedUnits, null, "infant")?.optionUnitId).toBe("u_child_0_5")
  })

  it("routes a roleHint=child traveler with no DOB to the 6-12 band", () => {
    expect(pickUnitForAge(ageBandedUnits, null, "child")?.optionUnitId).toBe("u_child_6_12")
  })

  it("routes a roleHint=adult traveler with no DOB to the adult band", () => {
    expect(pickUnitForAge(ageBandedUnits, null, "adult")?.optionUnitId).toBe("u_adult")
  })

  it("honors an exact DOB-derived age over the role hint", () => {
    // age 4 falls into 0-5; role hint is irrelevant when the band matches.
    expect(pickUnitForAge(ageBandedUnits, 4, "adult")?.optionUnitId).toBe("u_child_0_5")
  })

  it("falls back to ADULT-coded unit when no role hint and no DOB", () => {
    expect(pickUnitForAge(ageBandedUnits, null, null)?.optionUnitId).toBe("u_adult")
  })

  it("returns undefined for empty unit list", () => {
    expect(pickUnitForAge([], null, "child")).toBeUndefined()
  })
})

describe("pickUnitForAge — legacy bare-code units", () => {
  // Products where units are coded ADULT / CHILD / INFANT without min/max.
  const bareUnits: OptionUnitsStepperUnit[] = [
    unit({ optionUnitId: "u_adult", unitCode: "ADULT", unitName: "Adult" }),
    unit({ optionUnitId: "u_child", unitCode: "CHILD", unitName: "Child" }),
    unit({ optionUnitId: "u_infant", unitCode: "INFANT", unitName: "Infant" }),
  ]

  it("matches CHILD by code when no min/max configured", () => {
    expect(pickUnitForAge(bareUnits, null, "child")?.optionUnitId).toBe("u_child")
  })

  it("matches INFANT by code when no min/max configured", () => {
    expect(pickUnitForAge(bareUnits, null, "infant")?.optionUnitId).toBe("u_infant")
  })

  it("defaults to ADULT when no hint", () => {
    expect(pickUnitForAge(bareUnits, null, null)?.optionUnitId).toBe("u_adult")
  })
})

describe("pickUnitForAge — unit-type filtering", () => {
  it("skips non-person units when person units are present", () => {
    const mixed: OptionUnitsStepperUnit[] = [
      unit({
        optionUnitId: "u_room",
        unitCode: "ROOM",
        unitName: "Room",
        unitType: "room",
        minAge: 0,
      }),
      unit({
        optionUnitId: "u_adult",
        unitCode: "adult",
        unitName: "Adult",
        unitType: "person",
        minAge: 13,
      }),
      unit({
        optionUnitId: "u_child",
        unitCode: "child",
        unitName: "Child",
        unitType: "person",
        minAge: 0,
        maxAge: 12,
      }),
    ]
    expect(pickUnitForAge(mixed, null, "child")?.optionUnitId).toBe("u_child")
  })
})
