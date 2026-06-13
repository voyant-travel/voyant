import { describe, expect, it } from "vitest"

import { type PricingAssignmentUnit, resolveBookingDraft } from "../../../src/pricing-assignment.js"
import { NOW, traveler, unit } from "./fixtures.js"

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
