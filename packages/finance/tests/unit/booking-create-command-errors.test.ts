import { describe, expect, it } from "vitest"

import { bookingCreateCommandError } from "../../src/booking-create-command.js"

describe("booking create command errors", () => {
  it("explains room capacity failures as a corrective action", () => {
    const error = bookingCreateCommandError({
      status: "room_occupancy_insufficient",
      pax: 3,
      occupancyMax: 2,
      shortfall: 1,
    })

    expect(error.message).toMatch(/fit 2 traveler/)
    expect(error.message).toMatch(/Add room capacity for 1 more traveler/)
    expect(error.message).toMatch(/assign every traveler to a room/)
  })

  it("explains traveler and room payload mismatches", () => {
    const error = bookingCreateCommandError({
      status: "payload_resolver_mismatch",
      mismatches: [],
    })

    expect(error.message).toMatch(/traveler-to-room assignments/)
    expect(error.message).toMatch(/assign each traveler key/)
  })

  it("includes the invalid payment field and reason", () => {
    const error = bookingCreateCommandError({
      status: "invalid_payment_schedules",
      issues: [{ path: ["paymentSchedules", 0, "amountCents"], message: "Total is too high" }],
    })

    expect(error.message).toContain("paymentSchedules.0.amountCents: Total is too high")
  })

  // voyant#4805. `invalid_pricing` was the one refusal with no case of its own,
  // so it reached the caller as "The booking command failed validation." with
  // its issues dropped — and because that is the only status that could produce
  // that sentence, the message named nothing the caller did not already know.
  it("names the pricing rule that refused the booking", () => {
    const error = bookingCreateCommandError({
      status: "invalid_pricing",
      issues: [
        {
          path: ["itemLines"],
          message: "Booking item unit_twin has no active persisted price rule.",
        },
      ],
    })

    expect(error.code).toBe("INVALID_INPUT")
    expect(error.message).toContain(
      "itemLines: Booking item unit_twin has no active persisted price rule.",
    )
    expect(error.message).not.toContain("The booking command failed validation")
  })

  it("names the conflicting record instead of reporting a bare conflict", () => {
    const duplicate = bookingCreateCommandError({
      status: "duplicate_booking",
      existingBooking: { id: "bkg_1", bookingNumber: "BK-1042", status: "confirmed" },
    })
    const grouped = bookingCreateCommandError({
      status: "booking_already_in_group",
      currentGroupId: "grp_7",
    })

    expect(duplicate.message).toContain("BK-1042")
    expect(grouped.message).toContain("grp_7")
  })

  // The three `issues[]` siblings must stay formatted the same way; the defect
  // was one of them silently not being.
  it.each([
    ["invalid_payment_schedules", "The payment schedule is invalid"],
    ["invalid_tax_lines", "The tax lines are invalid"],
    ["invalid_pricing", "The pricing is invalid"],
  ] as const)("formats %s issues", (status, prefix) => {
    const error = bookingCreateCommandError({
      status,
      issues: [{ path: ["a", 1], message: "why" }],
    })

    expect(error.message).toBe(`${prefix}: a.1: why`)
  })
})
