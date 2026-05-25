import { describe, expect, it } from "vitest"

import {
  type BookingDraftTraveler,
  computeAgeYears,
  deriveDraftPaxBand,
  matchUnitByDob,
  matchUnitByRoleHint,
  type PricingAssignmentUnit,
  pickUnitForAge,
  resolveBookingDraft,
  resolveBookingExtraLines,
  travelersToRows,
  verifyBookingDraft,
} from "../../src/pricing-assignment.js"

const NOW = new Date("2026-05-25T00:00:00.000Z")

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

function traveler(partial: Partial<BookingDraftTraveler> = {}): BookingDraftTraveler {
  return {
    personId: partial.personId ?? null,
    firstName: partial.firstName ?? "Test",
    lastName: partial.lastName ?? "Traveler",
    email: partial.email ?? "",
    phone: partial.phone ?? "",
    preferredLanguage: partial.preferredLanguage ?? "",
    role: partial.role ?? "adult",
    dateOfBirth: partial.dateOfBirth ?? null,
    pricingUnitId: partial.pricingUnitId ?? null,
    inventoryUnitId: partial.inventoryUnitId ?? null,
    pricingUnitSource: partial.pricingUnitSource ?? "auto",
    inventoryUnitSource: partial.inventoryUnitSource ?? "auto",
  }
}

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

describe("resolveBookingDraft — person-priced excursion (Bulgaria shape)", () => {
  // Pro Travel's "Excursie Bulgaria" — pure-person option with
  // adult/child_6_12/child_0_5. Stepper sets qty=3 against the
  // primary (adult) unit; the resolver splits it across the bands
  // based on each traveler's DOB / role.
  const krushunaUnits: PricingAssignmentUnit[] = [
    unit({ optionUnitId: "u_adult", unitCode: "adult", minAge: 13 }),
    unit({ optionUnitId: "u_child_6_12", unitCode: "child_6_12", minAge: 6, maxAge: 12 }),
    unit({ optionUnitId: "u_child_0_5", unitCode: "child_0_5", minAge: 0, maxAge: 5 }),
  ]

  it("derives adult/child/infant quantities for a 3-pax age-banded excursion", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "lead" }),
        traveler({ role: "child" }),
        traveler({ role: "infant" }),
      ],
      units: krushunaUnits,
    })

    expect(result.quantities).toEqual({ u_adult: 1, u_child_6_12: 1, u_child_0_5: 1 })
    expect(result.travelerIndexesByUnitId).toEqual({
      u_adult: [0],
      u_child_6_12: [1],
      u_child_0_5: [2],
    })
  })

  it("recomputes stale auto Adult assignments when DOB is set on an existing traveler", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "lead", pricingUnitId: "u_adult" }),
        // Auto-assigned to adult by an earlier pass, then DOB filled in:
        traveler({ role: "adult", pricingUnitId: "u_adult", dateOfBirth: "2018-01-01" }),
        traveler({ role: "infant", pricingUnitId: "u_adult" }),
      ],
      units: krushunaUnits,
    })

    expect(result.travelers[1]?.pricingUnitId).toBe("u_child_6_12")
    expect(result.travelers[2]?.pricingUnitId).toBe("u_child_0_5")
  })

  it("preserves explicit operator category selections", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 3 },
      travelers: [
        traveler({ role: "lead" }),
        traveler({
          role: "child",
          pricingUnitId: "u_adult",
          pricingUnitSource: "manual",
        }),
        traveler({ role: "infant" }),
      ],
      units: krushunaUnits,
    })

    expect(result.travelers[1]?.pricingUnitId).toBe("u_adult")
    expect(result.travelers[1]?.pricingUnitSource).toBe("manual")
  })

  it("re-resolves stale manual person unit assignments when units change", () => {
    // Operator manually picked a unit on a previous product; product
    // changed; the old unit id is no longer in unitById, so the
    // resolver re-derives instead of leaving stale data.
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 1 },
      travelers: [
        traveler({
          role: "child",
          pricingUnitId: "u_stale_from_other_product",
          pricingUnitSource: "manual",
        }),
      ],
      units: krushunaUnits,
    })

    expect(result.travelers[0]?.pricingUnitId).toBe("u_child_6_12")
  })

  it("keeps No room as inventory-only intent", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 1 },
      travelers: [
        traveler({
          role: "adult",
          inventoryUnitId: null,
          inventoryUnitSource: "none",
        }),
      ],
      units: krushunaUnits,
    })

    expect(result.travelers[0]?.pricingUnitId).toBe("u_adult")
    expect(result.travelers[0]?.inventoryUnitId).toBeNull()
    expect(result.travelers[0]?.inventoryUnitSource).toBe("none")
    expect(result.travelerIndexesByUnitId).toEqual({ u_adult: [0] })
  })

  it("residual fills onto adult when stepper qty exceeds travelers", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult: 5 },
      travelers: [traveler({ role: "adult" }), traveler({ role: "child" })],
      units: krushunaUnits,
    })

    expect(result.quantities.u_adult).toBe(1 + 3)
    expect(result.quantities.u_child_6_12).toBe(1)
  })
})

describe("resolveBookingDraft — accommodation (Moldova DBL shape)", () => {
  // Pro Travel's "Circuit Moldova / DBL" — room unit + adult person
  // unit. Stepper picks 1 DBL; line item should stay "1 DBL room".
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

  it("keeps accommodation quantities as room quantities instead of traveler counts", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_dbl_room: 1 },
      travelers: [
        traveler({ role: "lead", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
        traveler({ role: "adult", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
      ],
      units: moldovaDblUnits,
    })

    expect(result.quantities).toEqual({ u_dbl_room: 1 })
    expect(result.travelers[0]?.pricingUnitId).toBe("u_adult_mol")
    expect(result.travelers[0]?.inventoryUnitId).toBe("u_dbl_room")
    expect(result.travelerIndexesByUnitId).toEqual({ u_dbl_room: [0, 1] })
  })

  it("normalizes legacy adult-keyed accommodation quantities onto the inventory unit", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_adult_mol: 1 },
      travelers: [
        traveler({ role: "lead", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
        traveler({ role: "adult", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
      ],
      units: moldovaDblUnits,
    })

    expect(result.quantities).toEqual({ u_dbl_room: 1 })
    expect(result.travelerIndexesByUnitId).toEqual({ u_dbl_room: [0, 1] })
  })

  it("preserves valid manual inventory assignments on resolver re-run", () => {
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_dbl_room: 1 },
      travelers: [
        traveler({ role: "lead", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
        traveler({ role: "adult", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
      ],
      units: moldovaDblUnits,
    })

    expect(result.travelers[0]?.inventoryUnitId).toBe("u_dbl_room")
    expect(result.travelers[0]?.inventoryUnitSource).toBe("manual")
    expect(result.travelers[1]?.inventoryUnitId).toBe("u_dbl_room")
    expect(result.travelers[1]?.inventoryUnitSource).toBe("manual")
    expect(result.travelerIndexesByUnitId).toEqual({ u_dbl_room: [0, 1] })
  })

  it("reassigns stale manual assignments when the option changes", () => {
    // Operator switched the room from DBL to TWN. The stale inventory
    // id is no longer in unitById, so the resolver re-derives both
    // placement and pricing for the selected option.
    const twnUnits: PricingAssignmentUnit[] = [
      unit({
        optionId: "opto_mol_twn",
        optionUnitId: "u_twn_room",
        unitCode: "twn_room",
        unitType: "room",
      }),
      unit({
        optionId: "opto_mol_twn",
        optionUnitId: "u_adult_twn",
        unitCode: "adult",
        unitType: "person",
        minAge: 18,
      }),
    ]
    const result = resolveBookingDraft({
      now: NOW,
      quantities: { u_twn_room: 1 },
      travelers: [
        traveler({ role: "lead", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
        traveler({ role: "adult", inventoryUnitId: "u_dbl_room", inventoryUnitSource: "manual" }),
      ],
      units: twnUnits,
    })

    expect(result.travelers[0]?.pricingUnitId).toBe("u_adult_twn")
    expect(result.travelers[1]?.pricingUnitId).toBe("u_adult_twn")
    expect(result.travelers[0]?.inventoryUnitId).toBe("u_twn_room")
    expect(result.travelers[1]?.inventoryUnitId).toBe("u_twn_room")
  })
})

describe("resolveBookingExtraLines", () => {
  it("normalizes per-person extras to charged traveler quantity and traveler links", () => {
    const result = resolveBookingExtraLines({
      travelerCount: 3,
      extraLines: [
        {
          productExtraId: "lunch",
          pricingMode: "per_person",
          pricedPerPerson: true,
          quantity: 1,
          unitSellAmountCents: 1000,
        },
        {
          productExtraId: "guide",
          pricingMode: "per_booking",
          quantity: 1,
          unitSellAmountCents: 5000,
        },
      ],
    })

    expect(result).toEqual([
      {
        productExtraId: "lunch",
        pricingMode: "per_person",
        pricedPerPerson: true,
        quantity: 3,
        unitSellAmountCents: 1000,
        totalSellAmountCents: 3000,
        clientLineKey: "extra:lunch",
        travelerIndexes: [0, 1, 2],
      },
      {
        productExtraId: "guide",
        pricingMode: "per_booking",
        quantity: 1,
        unitSellAmountCents: 5000,
        clientLineKey: "extra:guide",
      },
    ])
  })
})

describe("travelersToRows", () => {
  it("persists traveler category from DOB while keeping lead role separate", () => {
    const rows = travelersToRows(
      {
        travelers: [
          traveler({ role: "lead", dateOfBirth: "1990-01-01" }),
          traveler({ role: "child" }),
          traveler({ role: "adult", dateOfBirth: "2019-01-01" }),
        ],
      },
      NOW,
    )

    expect(rows[0]).toMatchObject({ isPrimary: true, travelerCategory: "adult" })
    expect(rows[1]).toMatchObject({ isPrimary: false, travelerCategory: "child" })
    // DOB wins over role for the third traveler — they're 7y old, so "child"
    expect(rows[2]).toMatchObject({ isPrimary: false, travelerCategory: "child" })
  })

  it("keeps legacy roomUnitId wire field as a pricing-tier alias", () => {
    const rows = travelersToRows({
      travelers: [
        traveler({
          role: "adult",
          pricingUnitId: "u_adult",
          pricingUnitSource: "manual",
          inventoryUnitId: "u_dbl_room",
          inventoryUnitSource: "manual",
        }),
      ],
    })

    expect(rows[0]?.roomUnitId).toBe("u_adult")
  })

  it("nulls out the legacy roomUnitId wire field for pricing source=none", () => {
    const rows = travelersToRows({
      travelers: [
        traveler({
          role: "adult",
          pricingUnitId: "u_adult",
          pricingUnitSource: "none",
          inventoryUnitId: "u_dbl_room",
          inventoryUnitSource: "manual",
        }),
      ],
    })

    expect(rows[0]?.roomUnitId).toBeNull()
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
