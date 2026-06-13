import { describe, expect, it } from "vitest"

import { travelersToRows } from "../../../src/pricing-assignment.js"
import { NOW, traveler } from "./fixtures.js"

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

  it("carries stable traveler keys into the booking-create wire rows", () => {
    const rows = travelersToRows({
      travelers: [traveler({ clientTravelerKey: "trav:lead", role: "lead" })],
    })

    expect(rows[0]?.clientTravelerKey).toBe("trav:lead")
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
