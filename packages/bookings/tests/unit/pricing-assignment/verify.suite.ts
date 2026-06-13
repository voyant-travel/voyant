import { describe, expect, it } from "vitest"

import { type PricingAssignmentUnit, verifyBookingDraft } from "../../../src/pricing-assignment.js"
import { unit } from "./fixtures.js"

describe("verifyBookingDraft", () => {
  const krushunaUnits: PricingAssignmentUnit[] = [
    unit({ optionUnitId: "u_adult", unitCode: "adult", minAge: 13 }),
    unit({ optionUnitId: "u_child_6_12", unitCode: "child_6_12", minAge: 6, maxAge: 12 }),
    unit({ optionUnitId: "u_child_0_5", unitCode: "child_0_5", minAge: 0, maxAge: 5 }),
  ]

  it("returns ok when submitted lines match what the resolver would derive", () => {
    const result = verifyBookingDraft({
      units: krushunaUnits,
      travelers: [
        { isPrimary: true, travelerCategory: "adult" },
        { isPrimary: false, travelerCategory: "child" },
        { isPrimary: false, travelerCategory: "infant" },
      ],
      itemLines: [
        { optionUnitId: "u_adult", quantity: 1, travelerIndexes: [0] },
        { optionUnitId: "u_child_6_12", quantity: 1, travelerIndexes: [1] },
        { optionUnitId: "u_child_0_5", quantity: 1, travelerIndexes: [2] },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  it("returns ok when submitted lines reference reordered travelers by stable keys", () => {
    const result = verifyBookingDraft({
      units: krushunaUnits,
      travelers: [
        { clientTravelerKey: "trav:child", isPrimary: false, travelerCategory: "child" },
        { clientTravelerKey: "trav:adult", isPrimary: true, travelerCategory: "adult" },
        { clientTravelerKey: "trav:infant", isPrimary: false, travelerCategory: "infant" },
      ],
      itemLines: [
        { optionUnitId: "u_adult", quantity: 1, travelerKeys: ["trav:adult"] },
        { optionUnitId: "u_child_6_12", quantity: 1, travelerKeys: ["trav:child"] },
        { optionUnitId: "u_child_0_5", quantity: 1, travelerKeys: ["trav:infant"] },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  it("prefers stable traveler keys over deprecated indexes", () => {
    const result = verifyBookingDraft({
      units: krushunaUnits,
      travelers: [
        { clientTravelerKey: "trav:child", isPrimary: false, travelerCategory: "child" },
        { clientTravelerKey: "trav:adult", isPrimary: true, travelerCategory: "adult" },
      ],
      itemLines: [
        {
          optionUnitId: "u_adult",
          quantity: 1,
          travelerKeys: ["trav:adult"],
          travelerIndexes: [0],
        },
        {
          optionUnitId: "u_child_6_12",
          quantity: 1,
          travelerKeys: ["trav:child"],
          travelerIndexes: [1],
        },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  it("flags the day-tour priced-as-adult bug shape (qty=3 adult, 1 child + 1 infant traveler)", () => {
    // Buggy client: 3 travelers (1 adult + 1 child + 1 infant) but
    // itemLines sent as "3 × Adult". Verifier should detect the
    // mismatch: resolver would split into 1 / 1 / 1.
    const result = verifyBookingDraft({
      units: krushunaUnits,
      travelers: [
        { isPrimary: true, travelerCategory: "adult" },
        { isPrimary: false, travelerCategory: "child" },
        { isPrimary: false, travelerCategory: "infant" },
      ],
      itemLines: [{ optionUnitId: "u_adult", quantity: 3, travelerIndexes: [0, 1, 2] }],
    })
    expect(result.ok).toBe(false)
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ optionUnitId: "u_adult", kind: "qty" }),
        expect.objectContaining({ optionUnitId: "u_child_6_12", kind: "missing" }),
        expect.objectContaining({ optionUnitId: "u_child_0_5", kind: "missing" }),
      ]),
    )
  })

  it("returns ok when no item lines (nothing to verify)", () => {
    expect(verifyBookingDraft({ travelers: [], itemLines: [], units: krushunaUnits })).toEqual({
      ok: true,
      mismatches: [],
    })
  })

  it("accepts accommodation: 1 DBL room line with 2 travelers — qty stays 1", () => {
    const moldovaDbl: PricingAssignmentUnit[] = [
      unit({
        optionId: "opto_mol_dbl",
        optionUnitId: "u_dbl_room",
        unitType: "room",
      }),
      unit({
        optionId: "opto_mol_dbl",
        optionUnitId: "u_adult_mol",
        unitType: "person",
        minAge: 18,
      }),
    ]
    const result = verifyBookingDraft({
      units: moldovaDbl,
      travelers: [
        { isPrimary: true, travelerCategory: "adult" },
        { isPrimary: false, travelerCategory: "adult" },
      ],
      itemLines: [{ optionUnitId: "u_dbl_room", quantity: 1, travelerIndexes: [0, 1] }],
    })
    expect(result.ok).toBe(true)
  })
})
