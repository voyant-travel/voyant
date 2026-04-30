import { describe, expect, it } from "vitest"

import type { Aircraft, Airline, Airport } from "./contract.js"
import { createStaticBundleReferenceProvider } from "./static-bundle.js"

const ba: Airline = { iataCode: "BA", icaoCode: "BAW", name: "British Airways", country: "GB" }
const aa: Airline = { iataCode: "AA", icaoCode: "AAL", name: "American Airlines", country: "US" }
const lhr: Airport = {
  iataCode: "LHR",
  name: "Heathrow",
  city: "London",
  country: "GB",
  timezone: "Europe/London",
}
const jfk: Airport = {
  iataCode: "JFK",
  name: "John F. Kennedy",
  city: "New York",
  country: "US",
  timezone: "America/New_York",
}
const b738: Aircraft = {
  iataCode: "738",
  icaoCode: "B738",
  name: "Boeing 737-800",
  manufacturer: "Boeing",
}

describe("createStaticBundleReferenceProvider", () => {
  it("infers capabilities from which arrays are populated", () => {
    const provider = createStaticBundleReferenceProvider({
      data: { airlines: [ba], airports: [lhr] },
    })
    expect(provider.capabilities.coversAirlines).toBe(true)
    expect(provider.capabilities.coversAirports).toBe(true)
    expect(provider.capabilities.coversAircraft).toBe(false)
    expect(provider.capabilities.refreshCadence).toBe("static")
    expect(provider.capabilities.isReadOnly).toBe(true)
  })

  it("getAirline returns the airline for a known code, null otherwise", async () => {
    const provider = createStaticBundleReferenceProvider({ data: { airlines: [ba, aa] } })
    expect(await provider.getAirline("BA")).toEqual(ba)
    expect(await provider.getAirline("XX")).toBeNull()
  })

  it("getAirport / getAircraft work the same way", async () => {
    const provider = createStaticBundleReferenceProvider({
      data: { airports: [lhr, jfk], aircraft: [b738] },
    })
    expect(await provider.getAirport("LHR")).toEqual(lhr)
    expect(await provider.getAircraft("738")).toEqual(b738)
    expect(await provider.getAircraft("999")).toBeNull()
  })

  it("getAirlines (batch) returns a Map of found codes only", async () => {
    const provider = createStaticBundleReferenceProvider({ data: { airlines: [ba, aa] } })
    const result = await provider.getAirlines(["BA", "AA", "XX"])
    expect(result.size).toBe(2)
    expect(result.get("BA")).toEqual(ba)
    expect(result.get("AA")).toEqual(aa)
    expect(result.has("XX")).toBe(false)
  })

  it("batch lookups deduplicate input codes", async () => {
    const provider = createStaticBundleReferenceProvider({ data: { airlines: [ba] } })
    const result = await provider.getAirlines(["BA", "BA", "BA"])
    expect(result.size).toBe(1)
  })

  it("empty input returns an empty Map", async () => {
    const provider = createStaticBundleReferenceProvider({ data: {} })
    expect((await provider.getAirlines([])).size).toBe(0)
    expect((await provider.getAirports([])).size).toBe(0)
    expect((await provider.getAircraftBatch([])).size).toBe(0)
  })

  it("capabilities can be overridden", () => {
    const provider = createStaticBundleReferenceProvider({
      data: { airlines: [ba] },
      capabilities: { refreshCadence: "weekly" },
    })
    expect(provider.capabilities.refreshCadence).toBe("weekly")
  })
})
