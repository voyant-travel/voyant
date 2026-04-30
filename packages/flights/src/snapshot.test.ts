import { describe, expect, it } from "vitest"

import type { FlightOffer, FlightOrder } from "./contract/types.js"
import { buildFlightSnapshotInput } from "./snapshot.js"

const sampleOffer: FlightOffer = {
  offerId: "ofr_abc",
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

const sampleOrder: FlightOrder = {
  orderId: "ord_xyz",
  pnr: "ABCDEF",
  status: "ticketed",
  offer: sampleOffer,
  passengers: [],
  totalPrice: { amount: "600", currency: "USD" },
  createdAt: "2026-09-01T12:00:00Z",
}

describe("buildFlightSnapshotInput", () => {
  it("composes a CaptureSnapshotInput with frozen offer + order", () => {
    const input = buildFlightSnapshotInput({
      offer: sampleOffer,
      order: sampleOrder,
      sourceKind: "voyant-connect",
      sourceProvider: "amadeus",
      sourceConnectionId: "conn_xyz",
    })
    expect(input.entityModule).toBe("flights")
    expect(input.entityId).toBe("ord_xyz")
    expect(input.sourceKind).toBe("voyant-connect")
    expect(input.sourceProvider).toBe("amadeus")
    expect(input.sourceConnectionId).toBe("conn_xyz")
    // sourceRef defaults to PNR when present
    expect(input.sourceRef).toBe("ABCDEF")
  })

  it("falls back to orderId for sourceRef when PNR is missing", () => {
    const orderNoPnr: FlightOrder = { ...sampleOrder, pnr: undefined }
    const input = buildFlightSnapshotInput({
      offer: sampleOffer,
      order: orderNoPnr,
      sourceKind: "direct:hisky",
    })
    expect(input.sourceRef).toBe("ord_xyz")
  })

  it("populates structured pricing columns from offer.totalPrice", () => {
    const input = buildFlightSnapshotInput({
      offer: sampleOffer,
      order: sampleOrder,
      sourceKind: "owned",
    })
    expect(input.pricingBasis).toBeDefined()
    expect(input.pricingBasis?.base_amount).toBe(600)
    expect(input.pricingBasis?.currency).toBe("USD")
    expect(input.pricingBasis?.breakdown).toEqual({
      fareBreakdowns: sampleOffer.fareBreakdowns,
    })
  })

  it("frozen_payload contains the full offer + order pair", () => {
    const input = buildFlightSnapshotInput({
      offer: sampleOffer,
      order: sampleOrder,
      sourceKind: "owned",
    })
    expect(input.frozenPayload).toEqual({ offer: sampleOffer, order: sampleOrder })
  })

  it("entityId can be overridden (e.g. for tour-package composite bookings)", () => {
    const input = buildFlightSnapshotInput({
      offer: sampleOffer,
      order: sampleOrder,
      sourceKind: "voyant-connect",
      entityId: "custom_entity_xyz",
    })
    expect(input.entityId).toBe("custom_entity_xyz")
  })
})
