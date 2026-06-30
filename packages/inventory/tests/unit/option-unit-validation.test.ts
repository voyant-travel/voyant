import { describe, expect, it } from "vitest"

import {
  insertOptionUnitSchema,
  updateOptionUnitSchema,
  validateMergedOptionUnit,
} from "../../src/validation-core.js"

describe("insertOptionUnitSchema — occupancy", () => {
  it("accepts a person unit without occupancy fields", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "Adult",
      unitType: "person",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a room unit when occupancyMin is set (≥ 1)", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "DBL",
      unitType: "room",
      occupancyMin: 2,
      occupancyMax: 2,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a room unit with no occupancyMin", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "SGL",
      unitType: "room",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "occupancyMin")
      expect(issue).toBeDefined()
      expect(issue?.message).toMatch(/occupancyMin/)
    }
  })

  it("rejects a room unit with occupancyMin = 0", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "SGL",
      unitType: "room",
      occupancyMin: 0,
    })
    expect(result.success).toBe(false)
  })

  it("applies the same constraint to vehicle units", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "Sedan",
      unitType: "vehicle",
    })
    expect(result.success).toBe(false)
  })

  it("rejects occupancyMax < occupancyMin", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "TPL",
      unitType: "room",
      occupancyMin: 3,
      occupancyMax: 2,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "occupancyMax")
      expect(issue).toBeDefined()
    }
  })
})

describe("insertOptionUnitSchema — quantity", () => {
  it("rejects maxQuantity < minQuantity", () => {
    const result = insertOptionUnitSchema.safeParse({
      name: "Family",
      minQuantity: 5,
      maxQuantity: 2,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "maxQuantity")
      expect(issue).toBeDefined()
      expect(issue?.message).toMatch(/maxQuantity/)
    }
  })
})

describe("updateOptionUnitSchema — occupancy", () => {
  it("accepts a partial patch that doesn't touch occupancy or unitType", () => {
    const result = updateOptionUnitSchema.safeParse({ name: "Renamed" })
    expect(result.success).toBe(true)
  })

  it("rejects a partial patch where occupancyMax < occupancyMin (both in patch)", () => {
    const result = updateOptionUnitSchema.safeParse({ occupancyMin: 4, occupancyMax: 2 })
    expect(result.success).toBe(false)
  })

  it("does not enforce the room-occupancy rule from the patch alone", () => {
    // Service layer enforces this against the merged record state. The
    // partial schema can't tell whether the persisted unit already has
    // occupancyMin set, so it stays out of the way here.
    const result = updateOptionUnitSchema.safeParse({ unitType: "room" })
    expect(result.success).toBe(true)
  })
})

describe("validateMergedOptionUnit", () => {
  it("passes when a room unit has valid occupancy", () => {
    expect(validateMergedOptionUnit({ unitType: "room", occupancyMin: 2 })).toEqual({ ok: true })
  })

  it("fails when a room unit's merged state has no occupancyMin", () => {
    const result = validateMergedOptionUnit({ unitType: "room", occupancyMin: null })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.path).toEqual(["occupancyMin"])
    }
  })

  it("fails when occupancyMax < occupancyMin in merged state", () => {
    const result = validateMergedOptionUnit({
      unitType: "room",
      occupancyMin: 3,
      occupancyMax: 2,
    })
    expect(result.ok).toBe(false)
  })

  it("fails when maxQuantity < minQuantity in merged state", () => {
    const result = validateMergedOptionUnit({
      minQuantity: 5,
      maxQuantity: 2,
    })

    expect(result).toEqual({
      ok: false,
      issues: [{ path: ["maxQuantity"], message: "maxQuantity must be ≥ minQuantity" }],
    })
  })

  it("ignores occupancy on non-room/vehicle types", () => {
    expect(validateMergedOptionUnit({ unitType: "person" })).toEqual({ ok: true })
    expect(validateMergedOptionUnit({ unitType: "service" })).toEqual({ ok: true })
  })
})
