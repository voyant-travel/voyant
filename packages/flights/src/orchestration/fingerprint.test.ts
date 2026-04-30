import { describe, expect, it } from "vitest"

import type { FlightOffer } from "../contract/types.js"
import { itineraryFingerprint } from "./fingerprint.js"

const offerLondonToNYC: FlightOffer = {
  offerId: "ofr_a",
  source: "amadeus",
  itineraries: [
    {
      segments: [
        {
          segmentId: "s1",
          carrierCode: "BA",
          flightNumber: "177",
          departure: { iataCode: "LHR", at: "2026-10-15T11:00:00+00:00" },
          arrival: { iataCode: "JFK", at: "2026-10-15T14:00:00-04:00" },
          cabin: "economy",
        },
      ],
    },
  ],
  fareBreakdowns: [
    {
      passengerType: "adult",
      passengerCount: 1,
      baseFare: { amount: "500", currency: "USD" },
      taxes: { amount: "100", currency: "USD" },
      total: { amount: "600", currency: "USD" },
    },
  ],
  totalPrice: { amount: "600", currency: "USD" },
}

describe("itineraryFingerprint", () => {
  it("produces a deterministic key from segments", () => {
    const fp = itineraryFingerprint(offerLondonToNYC)
    expect(fp).toBe("BA177|LHR|2026-10-15T11:00:00+00:00|JFK|2026-10-15T14:00:00-04:00|economy")
  })

  it("two providers selling the same flight produce identical fingerprints", () => {
    const fromAmadeus = { ...offerLondonToNYC, offerId: "ofr_amadeus", source: "amadeus" }
    const fromHisky = { ...offerLondonToNYC, offerId: "ofr_hisky", source: "hisky" }
    expect(itineraryFingerprint(fromAmadeus)).toBe(itineraryFingerprint(fromHisky))
  })

  it("differs when carrier changes", () => {
    const altered: FlightOffer = {
      ...offerLondonToNYC,
      itineraries: [
        {
          segments: [
            {
              ...offerLondonToNYC.itineraries[0]!.segments[0]!,
              carrierCode: "VS",
              flightNumber: "3",
            },
          ],
        },
      ],
    }
    expect(itineraryFingerprint(altered)).not.toBe(itineraryFingerprint(offerLondonToNYC))
  })

  it("differs when cabin class changes (price tier matters for grouping)", () => {
    const business: FlightOffer = {
      ...offerLondonToNYC,
      itineraries: [
        {
          segments: [{ ...offerLondonToNYC.itineraries[0]!.segments[0]!, cabin: "business" }],
        },
      ],
    }
    expect(itineraryFingerprint(business)).not.toBe(itineraryFingerprint(offerLondonToNYC))
  })

  it("multi-leg itineraries fingerprint with arrow separator between segments", () => {
    const multiLeg: FlightOffer = {
      ...offerLondonToNYC,
      itineraries: [
        {
          segments: [
            offerLondonToNYC.itineraries[0]!.segments[0]!,
            {
              segmentId: "s2",
              carrierCode: "AA",
              flightNumber: "100",
              departure: { iataCode: "JFK", at: "2026-10-22T10:00:00-04:00" },
              arrival: { iataCode: "LHR", at: "2026-10-22T22:00:00+00:00" },
              cabin: "economy",
            },
          ],
        },
      ],
    }
    expect(itineraryFingerprint(multiLeg)).toContain("→")
    expect(itineraryFingerprint(multiLeg).split("→")).toHaveLength(2)
  })
})
