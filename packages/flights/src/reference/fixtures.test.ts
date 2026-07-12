import { describe, expect, it, vi } from "vitest"

import {
  FLIGHT_REFERENCE_AIRCRAFT,
  FLIGHT_REFERENCE_AIRLINES,
  FLIGHT_REFERENCE_AIRPORTS,
  seedFlightReferenceFixtures,
} from "./fixtures.js"

describe("flight reference fixtures", () => {
  it("owns a stable, duplicate-free fixture", () => {
    expect(FLIGHT_REFERENCE_AIRLINES).toHaveLength(31)
    expect(FLIGHT_REFERENCE_AIRPORTS).toHaveLength(60)
    expect(FLIGHT_REFERENCE_AIRCRAFT).toHaveLength(27)

    for (const rows of [
      FLIGHT_REFERENCE_AIRLINES,
      FLIGHT_REFERENCE_AIRPORTS,
      FLIGHT_REFERENCE_AIRCRAFT,
    ]) {
      expect(new Set(rows.map((row) => row.iataCode)).size).toBe(rows.length)
    }
  })

  it("inserts every fixture group with conflict-safe semantics", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn(() => ({ onConflictDoNothing }))
    const insert = vi.fn(() => ({ values }))

    const counts = await seedFlightReferenceFixtures({ insert } as never)

    expect(counts).toEqual({ aircraft: 27, airlines: 31, airports: 60 })
    expect(insert).toHaveBeenCalledTimes(3)
    expect(values).toHaveBeenNthCalledWith(1, FLIGHT_REFERENCE_AIRLINES)
    expect(values).toHaveBeenNthCalledWith(2, FLIGHT_REFERENCE_AIRPORTS)
    expect(values).toHaveBeenNthCalledWith(3, FLIGHT_REFERENCE_AIRCRAFT)
    expect(onConflictDoNothing).toHaveBeenCalledTimes(3)
  })
})
