import { describe, expect, it } from "vitest"

import {
  type BookingDraftTraveler,
  type BookingDraftUnit,
  resolveBookingDraft,
  resolveBookingExtraLines,
  travelersToRows,
} from "../../src/components/booking-draft-resolver.js"

const NOW = new Date("2026-05-25T00:00:00.000Z")

function unit(partial: Partial<BookingDraftUnit> & Pick<BookingDraftUnit, "optionUnitId">) {
  return {
    optionId: partial.optionId ?? "opto_day_tour",
    optionUnitId: partial.optionUnitId,
    unitName: partial.unitName ?? partial.optionUnitId,
    unitCode: partial.unitCode ?? null,
    minAge: partial.minAge ?? null,
    maxAge: partial.maxAge ?? null,
    unitType: partial.unitType ?? "person",
  } satisfies BookingDraftUnit
}

function traveler(partial: Partial<BookingDraftTraveler> = {}) {
  return {
    personId: partial.personId ?? null,
    firstName: partial.firstName ?? "Test",
    lastName: partial.lastName ?? "Traveler",
    email: partial.email ?? "",
    phone: partial.phone ?? "",
    preferredLanguage: partial.preferredLanguage ?? "",
    role: partial.role ?? "adult",
    dateOfBirth: partial.dateOfBirth ?? null,
    roomUnitId: partial.roomUnitId ?? null,
    roomUnitAssignmentSource: partial.roomUnitAssignmentSource ?? "auto",
  } satisfies BookingDraftTraveler
}

describe("resolveBookingDraft", () => {
  const krushunaUnits = [
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

  it("derives adult, child, and infant quantities for a one-day person-priced excursion", () => {
    const result = resolveBookingDraft({
      quantities: { u_adult: 3 },
      units: krushunaUnits,
      travelers: [
        traveler({ role: "lead", dateOfBirth: "1989-04-01", roomUnitId: "u_adult" }),
        traveler({ role: "adult", dateOfBirth: "2017-06-01", roomUnitId: "u_adult" }),
        traveler({ role: "adult", dateOfBirth: "2025-01-01", roomUnitId: "u_adult" }),
      ],
      now: NOW,
    })

    expect(result.quantities).toEqual({
      u_adult: 1,
      u_child_6_12: 1,
      u_child_0_5: 1,
    })
    expect(result.travelers.map((t) => t.roomUnitId)).toEqual([
      "u_adult",
      "u_child_6_12",
      "u_child_0_5",
    ])
    expect(result.travelerIndexesByUnitId).toEqual({
      u_adult: [0],
      u_child_6_12: [1],
      u_child_0_5: [2],
    })
  })

  it("recomputes stale auto Adult assignments after an existing child person is selected", () => {
    const result = resolveBookingDraft({
      quantities: { u_adult: 1 },
      units: krushunaUnits,
      travelers: [
        traveler({
          role: "adult",
          dateOfBirth: "2017-06-01",
          roomUnitId: "u_adult",
          roomUnitAssignmentSource: "auto",
        }),
      ],
      now: NOW,
    })

    expect(result.quantities).toEqual({ u_child_6_12: 1 })
    expect(result.travelers[0]?.roomUnitId).toBe("u_child_6_12")
  })

  it("preserves explicit operator category selections", () => {
    const result = resolveBookingDraft({
      quantities: { u_adult: 1 },
      units: krushunaUnits,
      travelers: [
        traveler({
          role: "adult",
          dateOfBirth: "2017-06-01",
          roomUnitId: "u_adult",
          roomUnitAssignmentSource: "manual",
        }),
      ],
      now: NOW,
    })

    expect(result.quantities).toEqual({ u_adult: 1 })
    expect(result.travelers[0]?.roomUnitId).toBe("u_adult")
  })

  it("keeps accommodation quantities as room quantities instead of traveler counts", () => {
    const result = resolveBookingDraft({
      quantities: { u_double_room: 1 },
      units: [
        unit({
          optionId: "opto_double",
          optionUnitId: "u_double_room",
          unitName: "Double room",
          unitCode: "DBL",
          unitType: "room",
        }),
      ],
      travelers: [
        traveler({ role: "lead", dateOfBirth: "1988-01-01", roomUnitId: "u_double_room" }),
        traveler({ role: "adult", dateOfBirth: "1990-01-01", roomUnitId: "u_double_room" }),
      ],
      now: NOW,
    })

    expect(result.quantities).toEqual({ u_double_room: 1 })
    expect(result.travelers.map((t) => t.roomUnitId)).toEqual(["u_double_room", "u_double_room"])
    expect(result.travelerIndexesByUnitId).toEqual({ u_double_room: [0, 1] })
  })

  it("preserves explicit No room assignments", () => {
    const result = resolveBookingDraft({
      quantities: { u_double_room: 1 },
      units: [
        unit({
          optionId: "opto_double",
          optionUnitId: "u_double_room",
          unitName: "Double room",
          unitType: "room",
        }),
      ],
      travelers: [
        traveler({
          role: "adult",
          dateOfBirth: "1988-01-01",
          roomUnitId: null,
          roomUnitAssignmentSource: "none",
        }),
      ],
      now: NOW,
    })

    expect(result.quantities).toEqual({ u_double_room: 1 })
    expect(result.travelers[0]?.roomUnitId).toBeNull()
  })
})

describe("resolveBookingExtraLines", () => {
  it("normalizes per-person extras to charged traveler quantity and traveler links", () => {
    const result = resolveBookingExtraLines({
      travelerCount: 3,
      extraLines: [
        {
          productExtraId: "extra_lunch",
          name: "Lunch",
          pricingMode: "per_person",
          pricedPerPerson: true,
          quantity: 1,
          sellCurrency: "RON",
          unitSellAmountCents: 5000,
          totalSellAmountCents: 5000,
        },
      ],
    })

    expect(result[0]).toMatchObject({
      clientLineKey: "extra:extra_lunch",
      quantity: 3,
      totalSellAmountCents: 15000,
      travelerIndexes: [0, 1, 2],
    })
  })
})

describe("travelersToRows", () => {
  it("persists traveler category from DOB while keeping lead role separate", () => {
    const rows = travelersToRows(
      {
        travelers: [
          traveler({ role: "lead", dateOfBirth: "2017-06-01", roomUnitId: "u_child_6_12" }),
        ],
      },
      NOW,
    )

    expect(rows[0]).toMatchObject({
      isPrimary: true,
      travelerCategory: "child",
      roomUnitId: "u_child_6_12",
    })
  })
})
