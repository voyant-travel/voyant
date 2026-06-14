import { describe, expect, it } from "vitest"

import { isTravelerCategory } from "./product-options-pricing.js"

describe("isTravelerCategory", () => {
  // Traveler/pax categories are the per-person price columns in the rooms/seats
  // grid and must be kept.
  it.each([
    "adult",
    "child",
    "infant",
    "senior",
    "group",
    "other",
  ] as const)("treats %s as a traveler column", (categoryType) => {
    expect(isTravelerCategory({ categoryType })).toBe(true)
  })

  // room/vehicle describe the unit dimension (already the grid rows) and
  // `service` is a standalone add-on — none are per-traveler price columns.
  // A product carrying these (e.g. a legacy "Double room" pricing category, or
  // a tenant-wide default set) must not sprout a bogus column per room.
  it.each([
    "room",
    "vehicle",
    "service",
  ] as const)("excludes %s from traveler columns", (categoryType) => {
    expect(isTravelerCategory({ categoryType })).toBe(false)
  })
})
