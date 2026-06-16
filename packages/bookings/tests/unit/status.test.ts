import { describe, expect, it } from "vitest"

import {
  BOOKING_RESOURCE_AVAILABILITY_STATUSES,
  isBookingResourceAvailabilityStatus,
} from "../../src/status.js"

describe("booking resource availability statuses", () => {
  it("uses current booking status enum values for resource availability counts", () => {
    expect(BOOKING_RESOURCE_AVAILABILITY_STATUSES).toEqual([
      "draft",
      "on_hold",
      "awaiting_payment",
      "confirmed",
      "in_progress",
    ])
    expect(BOOKING_RESOURCE_AVAILABILITY_STATUSES).not.toContain("pending")
    expect(BOOKING_RESOURCE_AVAILABILITY_STATUSES).not.toContain("checked_in")
  })

  it("checks resource availability status membership", () => {
    expect(isBookingResourceAvailabilityStatus("awaiting_payment")).toBe(true)
    expect(isBookingResourceAvailabilityStatus("cancelled")).toBe(false)
    expect(isBookingResourceAvailabilityStatus("checked_in")).toBe(false)
  })
})
