import { describe, expect, it } from "vitest"

import {
  bookingStatusSchema,
  bookingTravelerBedPreferenceSchema,
  travelerAllocationMapSchema,
} from "./index.js"

describe("@voyantjs/bookings-contracts", () => {
  it("validates booking status enum values", () => {
    expect(bookingStatusSchema.safeParse("confirmed").success).toBe(true)
    expect(bookingStatusSchema.safeParse("not_a_status").success).toBe(false)
  })

  it("validates the relocated traveler primitives", () => {
    expect(bookingTravelerBedPreferenceSchema.safeParse("twin").success).toBe(true)
    expect(bookingTravelerBedPreferenceSchema.safeParse("waterbed").success).toBe(false)
    expect(travelerAllocationMapSchema.safeParse({ trav_1: "room_a" }).success).toBe(true)
    expect(travelerAllocationMapSchema.safeParse({ trav_1: 42 }).success).toBe(false)
  })
})
