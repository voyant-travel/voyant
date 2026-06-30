import type { FlightSearchRequest } from "@voyant-travel/flights/contract/types"
import { describe, expect, it, vi } from "vitest"

import { createDemoFlightAdapter } from "./adapter.js"

const SEARCH_REQUEST: FlightSearchRequest = {
  slices: [{ origin: "LGW", destination: "BCN", departureDate: "2026-07-01" }],
  passengers: { adults: 1 },
  cabin: "economy",
}

describe("createDemoFlightAdapter", () => {
  it("normalizes transport failures into a setup-specific error", async () => {
    const adapter = createDemoFlightAdapter({
      baseUrl: "http://localhost:3320/",
      fetch: vi.fn(async () => {
        throw new TypeError("Network connection lost.")
      }) as typeof fetch,
    })

    await expect(adapter.searchFlights({ connectionId: "demo" }, SEARCH_REQUEST)).rejects.toThrow(
      "Flights demo service is unavailable at http://localhost:3320. Start it with `pnpm --dir apps/flights-demo-api dev` or update FLIGHTS_DEMO_API_URL.",
    )
  })

  it("keeps HTTP error handling stable for non-JSON responses", async () => {
    const adapter = createDemoFlightAdapter({
      baseUrl: "http://localhost:3320",
      fetch: vi.fn(async () => new Response("<!doctype html>", { status: 502 })) as typeof fetch,
    })

    await expect(adapter.searchFlights({ connectionId: "demo" }, SEARCH_REQUEST)).rejects.toThrow(
      "flights-demo-api /search failed: 502",
    )
  })

  it("rejects non-JSON successful responses", async () => {
    const adapter = createDemoFlightAdapter({
      baseUrl: "http://localhost:3320",
      fetch: vi.fn(async () => new Response("<!doctype html>", { status: 200 })) as typeof fetch,
    })

    await expect(adapter.searchFlights({ connectionId: "demo" }, SEARCH_REQUEST)).rejects.toThrow(
      "flights-demo-api /search returned invalid JSON",
    )
  })
})
