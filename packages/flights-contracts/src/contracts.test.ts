import { describe, expect, it } from "vitest"

import { flightSearchRequestSchema, moneySchema } from "./index.js"

describe("@voyant-travel/flights-contracts barrel", () => {
  it("parses a minimal valid flight search request", () => {
    const value = {
      slices: [{ origin: "LHR", destination: "JFK", departureDate: "2026-10-15" }],
      passengers: { adults: 1 },
      cabin: "economy",
    }
    expect(flightSearchRequestSchema.parse(value)).toEqual(value)
  })

  it("rejects an invalid flight search request", () => {
    expect(
      flightSearchRequestSchema.safeParse({ slices: [], passengers: { adults: -1 } }).success,
    ).toBe(false)
  })

  it("rejects money with a non-decimal-string amount", () => {
    expect(moneySchema.safeParse({ amount: 600, currency: "USD" }).success).toBe(false)
  })
})
