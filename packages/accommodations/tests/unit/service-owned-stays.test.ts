import { describe, expect, it } from "vitest"

import {
  eachStayNight,
  type ResolveOwnedStayQuoteRecords,
  resolveOwnedStayQuote,
} from "../../src/service-owned-stays.js"

const baseRecords: ResolveOwnedStayQuoteRecords = {
  room: {
    id: "room_std",
    propertyId: "prop_1",
    active: true,
    maxAdults: 2,
    maxChildren: 1,
    maxInfants: 1,
    maxOccupancy: 3,
  },
  ratePlan: {
    id: "rate_bar",
    propertyId: "prop_1",
    active: true,
    mealPlanId: "meal_bb",
  },
  rates: [
    {
      date: "2026-09-01",
      sellCurrency: "USD",
      sellAmountCents: 12_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
    {
      date: "2026-09-02",
      sellCurrency: "USD",
      sellAmountCents: 13_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
    {
      date: "2026-09-03",
      sellCurrency: "USD",
      sellAmountCents: 14_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
  ],
  inventory: [
    { date: "2026-09-01", capacity: 3 },
    { date: "2026-09-02", capacity: 3 },
    { date: "2026-09-03", capacity: 3 },
  ],
  overlappingBookings: [
    {
      checkInDate: "2026-09-02",
      checkOutDate: "2026-09-04",
      roomCount: 1,
    },
  ],
}

describe("eachStayNight", () => {
  it("enumerates occupied stay nights from check-in through exclusive check-out", () => {
    expect(eachStayNight("2026-09-01", "2026-09-04")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ])
    expect(eachStayNight("2026-09-01", "2026-09-01")).toEqual([])
  })
})

describe("resolveOwnedStayQuote", () => {
  it("returns nightly and total price while subtracting overlapping booked stays", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
        roomCount: 2,
        occupancy: { adults: 2 },
        currency: "USD",
      },
      baseRecords,
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.available).toBe(true)
    expect(result.propertyId).toBe("prop_1")
    expect(result.mealPlanId).toBe("meal_bb")
    expect(result.totalAmountCents).toBe(78_000)
    expect(result.nightlyRates.map((rate) => rate.totalAmountCents)).toEqual([
      24_000, 26_000, 28_000,
    ])
    expect(result.availability.minimumRemainingRooms).toBe(2)
    expect(result.availability.nights.map((night) => night.remaining)).toEqual([3, 2, 2])
  })

  it("reports missing nightly rates for the requested range", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
      },
      { ...baseRecords, rates: baseRecords.rates.slice(0, 2) },
    )

    expect(result).toEqual({ status: "rates_missing", missingDates: ["2026-09-03"] })
  })

  it("marks a stay unavailable when any requested night is closed", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
      },
      {
        ...baseRecords,
        inventory: [
          { date: "2026-09-01", capacity: 3 },
          { date: "2026-09-02", capacity: 3, closed: true },
          { date: "2026-09-03", capacity: 3 },
        ],
      },
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.available).toBe(false)
    expect(result.availability.minimumRemainingRooms).toBe(0)
  })

  it("rejects occupancies beyond room limits", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
        occupancy: { adults: 3 },
      },
      baseRecords,
    )

    expect(result.status).toBe("room_occupancy_exceeded")
  })
})
