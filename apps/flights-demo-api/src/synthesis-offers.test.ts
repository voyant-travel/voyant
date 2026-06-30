import type { FlightSearchRequest } from "@voyant-travel/flights/contract/types"
import { describe, expect, it } from "vitest"

import { synthesizeOffers } from "./synthesis-offers.js"

const PASSENGERS = { adults: 1, children: 0, infants: 0 }

function legRequest(
  origin: string,
  destination: string,
  departureDate: string,
): FlightSearchRequest {
  return {
    slices: [{ origin, destination, departureDate }],
    passengers: PASSENGERS,
    cabin: "economy",
  }
}

describe("synthesizeOffers offer ids", () => {
  it("gives opposite round-trip directions disjoint offer ids (#2652)", () => {
    const outbound = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    const returnLeg = synthesizeOffers(legRequest("FCO", "BCN", "2026-07-17"))

    expect(outbound.length).toBeGreaterThan(0)
    expect(returnLeg.length).toBeGreaterThan(0)

    const outboundIds = new Set(outbound.map((offer) => offer.offerId))
    const overlap = returnLeg.filter((offer) => outboundIds.has(offer.offerId))
    expect(overlap).toEqual([])
  })

  it("stays disjoint even when both legs share the same date", () => {
    const outbound = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    const returnLeg = synthesizeOffers(legRequest("FCO", "BCN", "2026-07-10"))

    const outboundIds = new Set(outbound.map((offer) => offer.offerId))
    expect(returnLeg.some((offer) => outboundIds.has(offer.offerId))).toBe(false)
  })

  it("encodes direction and date in the offer id", () => {
    const [offer] = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    expect(offer?.offerId).toMatch(/^demo_BCNFCO20260710_/)
  })

  it("is stable: the same request reproduces the same offer ids", () => {
    const first = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    const second = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    expect(first.map((offer) => offer.offerId)).toEqual(second.map((offer) => offer.offerId))
  })

  it("keeps offer ids unique within a single search pool", () => {
    const offers = synthesizeOffers(legRequest("BCN", "FCO", "2026-07-10"))
    const ids = offers.map((offer) => offer.offerId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
