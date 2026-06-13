import { describe, expect, it } from "vitest"

import {
  computeAgeYears,
  deriveDraftPaxBand,
  matchUnitByDob,
  matchUnitByRoleHint,
  pickUnitForAge,
} from "../../../src/pricing-assignment.js"
import { NOW, unit } from "./fixtures.js"

describe("computeAgeYears", () => {
  it("returns null for null DOB", () => {
    expect(computeAgeYears(null)).toBeNull()
  })

  it("returns null for unparseable DOB", () => {
    expect(computeAgeYears("not-a-date")).toBeNull()
  })

  it("computes age before birthday correctly", () => {
    expect(computeAgeYears("2020-12-15", new Date("2026-06-01"))).toBe(5)
  })

  it("computes age on birthday correctly", () => {
    expect(computeAgeYears("2020-06-01", new Date("2026-06-01"))).toBe(6)
  })

  it("returns null for future DOB", () => {
    expect(computeAgeYears("2030-01-01", new Date("2026-06-01"))).toBeNull()
  })
})

describe("pickUnitForAge — age-banded unit codes (issue #1262)", () => {
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

  it("honors an exact DOB-derived age over the role hint", () => {
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

describe("matchUnitByDob / matchUnitByRoleHint", () => {
  const ageBandedUnits: PricingAssignmentUnit[] = [
    unit({ optionUnitId: "u_adult", minAge: 13 }),
    unit({ optionUnitId: "u_child_6_12", minAge: 6, maxAge: 12 }),
    unit({ optionUnitId: "u_child_0_5", minAge: 0, maxAge: 5 }),
  ]

  it("matchUnitByDob returns null for null DOB", () => {
    expect(matchUnitByDob(ageBandedUnits, null)).toBeNull()
  })

  it("matchUnitByDob picks the band containing the age", () => {
    expect(matchUnitByDob(ageBandedUnits, "2018-01-01")).toBe("u_child_6_12")
  })

  it("matchUnitByRoleHint returns null for 'lead'", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "lead")).toBeNull()
  })

  it("matchUnitByRoleHint maps infant → 0-5", () => {
    expect(matchUnitByRoleHint(ageBandedUnits, "infant")).toBe("u_child_0_5")
  })

  it("matchUnitByRoleHint returns null when units have no age bands", () => {
    const bare: PricingAssignmentUnit[] = [
      unit({ optionUnitId: "u_adult", unitCode: "ADULT" }),
      unit({ optionUnitId: "u_child", unitCode: "CHILD" }),
    ]
    expect(matchUnitByRoleHint(bare, "child")).toBeNull()
  })
})

describe("deriveDraftPaxBand", () => {
  it("derives infant for under-2", () => {
    expect(deriveDraftPaxBand({ dateOfBirth: "2025-01-01", role: "adult" }, NOW)).toBe("infant")
  })

  it("derives child for 2-17", () => {
    expect(deriveDraftPaxBand({ dateOfBirth: "2018-01-01", role: "adult" }, NOW)).toBe("child")
  })

  it("derives adult for 18+", () => {
    expect(deriveDraftPaxBand({ dateOfBirth: "1990-01-01", role: "infant" }, NOW)).toBe("adult")
  })

  it("falls back to role when DOB is null", () => {
    expect(deriveDraftPaxBand({ dateOfBirth: null, role: "child" }, NOW)).toBe("child")
  })

  it("returns null for lead role with no DOB", () => {
    expect(deriveDraftPaxBand({ dateOfBirth: null, role: "lead" }, NOW)).toBeNull()
  })
})
