import { describe, expect, it } from "vitest"

import {
  type AssignmentTraveler,
  computeAgeYears,
  derivePricingAssignment,
  matchUnitByDob,
  matchUnitByRoleHint,
  type PricingAssignmentUnit,
  pickUnitForAge,
} from "../../src/pricing-assignment.js"

function unit(
  partial: Partial<PricingAssignmentUnit> & Pick<PricingAssignmentUnit, "optionUnitId">,
): PricingAssignmentUnit {
  return {
    optionId: partial.optionId ?? "opto_day_tour",
    optionUnitId: partial.optionUnitId,
    unitName: partial.unitName ?? partial.optionUnitId,
    unitCode: partial.unitCode ?? null,
    minAge: partial.minAge ?? null,
    maxAge: partial.maxAge ?? null,
    unitType: partial.unitType ?? "person",
  }
}

function traveler(partial: Partial<AssignmentTraveler> = {}): AssignmentTraveler {
  return {
    dateOfBirth: partial.dateOfBirth ?? null,
    role: partial.role ?? null,
    assignedUnitId: partial.assignedUnitId ?? null,
  }
}

describe("computeAgeYears", () => {
  it("returns null for null or empty DOB", () => {
    expect(computeAgeYears(null)).toBeNull()
  })

  it("returns null for unparseable DOB", () => {
    expect(computeAgeYears("not-a-date")).toBeNull()
  })

  it("computes age before birthday correctly", () => {
    expect(computeAgeYears("2020-12-15", new Date("2026-06-01"))).toBe(5)
  })

  it("computes age after birthday correctly", () => {
    expect(computeAgeYears("2020-03-15", new Date("2026-06-01"))).toBe(6)
  })

  it("computes age on birthday correctly", () => {
    expect(computeAgeYears("2020-06-01", new Date("2026-06-01"))).toBe(6)
  })

  it("returns null for future DOB", () => {
    expect(computeAgeYears("2030-01-01", new Date("2026-06-01"))).toBeNull()
  })
})

describe("pickUnitForAge — age-banded unit codes (issue #1262)", () => {
  // Day-tour product whose age bands are encoded in the unit codes
  // instead of bare ADULT/CHILD/INFANT. Reproduces the layout that
  // broke after #1241 and #1263.
  const ageBandedUnits: PricingAssignmentUnit[] = [
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
  const bareUnits: PricingAssignmentUnit[] = [
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
    const mixed: PricingAssignmentUnit[] = [
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

describe("matchUnitByDob", () => {
  const units: PricingAssignmentUnit[] = [
    unit({ optionUnitId: "u_adult", minAge: 13 }),
    unit({ optionUnitId: "u_child", minAge: 0, maxAge: 12 }),
  ]

  it("returns null when DOB is null", () => {
    expect(matchUnitByDob(units, null)).toBeNull()
  })

  it("matches the age-band unit when DOB falls in the window", () => {
    expect(matchUnitByDob(units, "2018-01-01")).toBe("u_child")
  })

  it("returns null when no unit's window contains the age", () => {
    // gap unit set: 0-5 and 13+, nothing for ages 6-12
    const gappy: PricingAssignmentUnit[] = [
      unit({ optionUnitId: "u_adult", minAge: 13 }),
      unit({ optionUnitId: "u_infant", minAge: 0, maxAge: 5 }),
    ]
    expect(matchUnitByDob(gappy, "2017-01-01")).toBeNull()
  })
})

describe("matchUnitByRoleHint", () => {
  const ageBandedUnits: PricingAssignmentUnit[] = [
    unit({ optionUnitId: "u_adult", minAge: 13 }),
    unit({ optionUnitId: "u_child_6_12", minAge: 6, maxAge: 12 }),
    unit({ optionUnitId: "u_child_0_5", minAge: 0, maxAge: 5 }),
  ]

  it("returns null for null role", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, null)).toBeNull()
  })

  it("returns null for 'lead' role (no age signal)", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "lead")).toBeNull()
  })

  it("maps infant → 0-5 band", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "infant")).toBe("u_child_0_5")
  })

  it("maps child → 6-12 band", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "child")).toBe("u_child_6_12")
  })

  it("maps adult → adult band", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "adult")).toBe("u_adult")
  })

  it("returns null when units have no age bands at all", () => {
    const bare: PricingAssignmentUnit[] = [
      unit({ optionUnitId: "u_adult", unitCode: "ADULT" }),
      unit({ optionUnitId: "u_child", unitCode: "CHILD" }),
    ]
    expect(matchUnitByRoleHint(bare, "child")).toBeNull()
  })
})

describe("derivePricingAssignment — excursion (pricing-only, age-banded)", () => {
  // Pro Travel's "Excursie Bulgaria" shape — pure-person option with
  // adult/child_6_12/child_0_5. The stepper sets qty=3 against the
  // primary (adult) unit; we expect derive to split it across the
  // bands based on each traveler's DOB / role.
  const bulgariaUnits: PricingAssignmentUnit[] = [
    unit({ optionId: "opto_bg", optionUnitId: "u_adult", unitCode: "adult", minAge: 13 }),
    unit({
      optionId: "opto_bg",
      optionUnitId: "u_child_6_12",
      unitCode: "child_6_12",
      minAge: 6,
      maxAge: 12,
    }),
    unit({
      optionId: "opto_bg",
      optionUnitId: "u_child_0_5",
      unitCode: "child_0_5",
      minAge: 0,
      maxAge: 5,
    }),
  ]

  it("redistributes a 3-pax adult/child/infant booking onto the right bands", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "lead" }), // adult-equivalent, no DOB
        traveler({ role: "child" }),
        traveler({ role: "infant" }),
      ],
      units: bulgariaUnits,
    })

    expect(result.assignedUnitIds).toEqual(["u_adult", "u_child_6_12", "u_child_0_5"])
    expect(result.quantities).toEqual({ u_adult: 1, u_child_6_12: 1, u_child_0_5: 1 })
  })

  it("uses DOB when present, role hint when not", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "adult" }),
        traveler({ dateOfBirth: "2019-01-01" }), // age ~7 — matches 6-12 band
        traveler({ role: "infant" }),
      ],
      units: bulgariaUnits,
    })

    expect(result.assignedUnitIds).toEqual(["u_adult", "u_child_6_12", "u_child_0_5"])
  })

  it("preserves an operator-picked unit that is still valid", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "lead" }),
        traveler({ role: "child", assignedUnitId: "u_adult" }), // operator overrode
        traveler({ role: "infant" }),
      ],
      units: bulgariaUnits,
    })

    // operator's choice wins for traveler 1
    expect(result.assignedUnitIds[1]).toBe("u_adult")
  })

  it("residual fills onto the adult unit when stepper qty exceeds travelers", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult: 5 },
      travelers: [traveler({ role: "adult" }), traveler({ role: "child" })],
      units: bulgariaUnits,
    })

    // 2 travelers assigned; 3 residual rooms; all 3 land on u_adult
    expect(result.quantities.u_adult).toBe(1 + 3)
    expect(result.quantities.u_child_6_12).toBe(1)
  })
})

describe("derivePricingAssignment — multi-day package (rooms + persons)", () => {
  // Pro Travel's "Circuit Moldova / DBL option" shape — adult per-pax
  // fee plus the room container. The room unit is required and lives
  // alongside the adult unit on the same option.
  const moldovaDblUnits: PricingAssignmentUnit[] = [
    unit({
      optionId: "opto_mol_dbl",
      optionUnitId: "u_dbl_room",
      unitCode: "dbl_room",
      unitType: "room",
    }),
    unit({
      optionId: "opto_mol_dbl",
      optionUnitId: "u_adult_mol",
      unitCode: "adult",
      unitType: "person",
      minAge: 18,
    }),
  ]

  it("ignores room units when picking a traveler's pricing tier", () => {
    expect(pickUnitForAge(moldovaDblUnits, null, "adult")?.optionUnitId).toBe("u_adult_mol")
  })

  it("derive returns the person unit, not the room unit, for each traveler", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult_mol: 2 },
      travelers: [traveler({ role: "lead" }), traveler({ role: "adult" })],
      units: moldovaDblUnits,
    })

    expect(result.assignedUnitIds).toEqual(["u_adult_mol", "u_adult_mol"])
    expect(result.quantities).toEqual({ u_adult_mol: 2 })
  })
})

describe("derivePricingAssignment — flat excursion (single pricing tier)", () => {
  // Pro Travel's "Excursie Festivalul Scrumbiei" shape — a single
  // Adult unit with no age bands. Every traveler maps to it.
  const flatUnits: PricingAssignmentUnit[] = [
    unit({ optionId: "opto_scr", optionUnitId: "u_adult_scr", unitCode: "adult" }),
  ]

  it("assigns every traveler to the single unit", () => {
    const result = derivePricingAssignment({
      quantities: { u_adult_scr: 3 },
      travelers: [
        traveler({ role: "lead" }),
        traveler({ role: "child" }), // no child band exists; falls to the one available
        traveler({ role: "adult" }),
      ],
      units: flatUnits,
    })

    expect(result.assignedUnitIds).toEqual(["u_adult_scr", "u_adult_scr", "u_adult_scr"])
    expect(result.quantities).toEqual({ u_adult_scr: 3 })
  })
})

describe("derivePricingAssignment — edge cases", () => {
  it("returns input unchanged when units array is empty", () => {
    const result = derivePricingAssignment({
      quantities: { foo: 1 },
      travelers: [traveler({ assignedUnitId: "foo" })],
      units: [],
    })
    expect(result.assignedUnitIds).toEqual(["foo"])
    expect(result.quantities).toEqual({ foo: 1 })
  })

  it("invalidates assignments pointing at units not in the current option set", () => {
    const units: PricingAssignmentUnit[] = [
      unit({ optionId: "opto_a", optionUnitId: "u_a", unitCode: "adult" }),
    ]
    const result = derivePricingAssignment({
      quantities: { u_a: 1 },
      travelers: [traveler({ role: "adult", assignedUnitId: "u_stale_from_prev_product" })],
      units,
    })
    // Stale unitId not in current units → re-derive
    expect(result.assignedUnitIds).toEqual(["u_a"])
  })

  it("does nothing when quantities is empty", () => {
    const units: PricingAssignmentUnit[] = [unit({ optionId: "opto_a", optionUnitId: "u_a" })]
    const result = derivePricingAssignment({
      quantities: {},
      travelers: [traveler({ role: "adult" })],
      units,
    })
    // No option has demand, so no assignment happens
    expect(result.assignedUnitIds).toEqual([null])
    expect(result.quantities).toEqual({})
  })
})
