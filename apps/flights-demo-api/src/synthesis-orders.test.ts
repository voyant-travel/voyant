import type { FlightOrder } from "@voyant-travel/flights/contract/types"
import { describe, expect, it } from "vitest"

import { ticketHeldOrder } from "./synthesis-orders.js"

function heldOrder(overrides: Partial<FlightOrder> = {}): FlightOrder {
  return {
    orderId: "demo_ord_abc123",
    pnr: "ABC123",
    status: "confirmed",
    offer: {
      offerId: "off_1",
      source: "demo",
      itineraries: [{ segments: [{ segmentId: "seg_1" }, { segmentId: "seg_2" }] }],
      fareBreakdowns: [],
      totalPrice: { amount: "100.00", currency: "EUR" },
      validatingCarrier: "W6",
    },
    passengers: [{ passengerId: "pax_1" }, { passengerId: "pax_2" }],
    totalPrice: { amount: "100.00", currency: "EUR" },
    paymentDeadline: "2026-07-10T12:00:00.000Z",
    createdAt: "2026-07-04T09:00:00.000Z",
    updatedAt: "2026-07-04T09:00:00.000Z",
    ...overrides,
  } as unknown as FlightOrder
}

describe("ticketHeldOrder", () => {
  it("promotes a held order to ticketed with a ticket per passenger", () => {
    const ticketed = ticketHeldOrder(heldOrder())
    expect(ticketed.status).toBe("ticketed")
    expect(ticketed.paymentDeadline).toBeUndefined()
    expect(ticketed.tickets).toHaveLength(2)
    expect(ticketed.tickets?.[0]?.passengerId).toBe("pax_1")
    expect(ticketed.tickets?.[0]?.ticketNumber).toMatch(/^W6\d{9}$/)
    expect(ticketed.tickets?.[0]?.segmentIds).toEqual(["seg_1", "seg_2"])
  })

  it("is deterministic for the same order id", () => {
    const a = ticketHeldOrder(heldOrder())
    const b = ticketHeldOrder(heldOrder())
    expect(a.tickets?.[0]?.ticketNumber).toBe(b.tickets?.[0]?.ticketNumber)
  })
})
