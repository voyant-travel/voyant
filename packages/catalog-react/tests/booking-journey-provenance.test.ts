import { describe, expect, it } from "vitest"

import { bookingJourneyProvenanceSearchParams } from "../src/admin/booking-journey-provenance.js"

describe("bookingJourneyProvenanceSearchParams", () => {
  it("omits unscoped voyant-connect kind so the booking route resolves provenance", () => {
    expect(
      bookingJourneyProvenanceSearchParams({
        sourceKind: "voyant-connect",
        sourceRef: "offer_1",
      }),
    ).toEqual({ sourceRef: "offer_1" })
  })

  it("keeps voyant-connect when a connection id can route the adapter", () => {
    expect(
      bookingJourneyProvenanceSearchParams({
        sourceKind: "voyant-connect",
        sourceConnectionId: "conn_1",
        sourceRef: "offer_1",
      }),
    ).toEqual({
      sourceKind: "voyant-connect",
      sourceConnectionId: "conn_1",
      sourceRef: "offer_1",
    })
  })

  it("keeps registered non-connect source kinds", () => {
    expect(bookingJourneyProvenanceSearchParams({ sourceKind: "demo" })).toEqual({
      sourceKind: "demo",
    })
  })
})
