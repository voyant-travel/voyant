import { describe, expect, it } from "vitest"

import {
  type FlightAdapterContext,
  FlightCapabilityNotSupportedError,
  type FlightConnectorAdapter,
  requireCapability,
} from "./adapter.js"
import { FLIGHT_CAPABILITIES, type FlightOffer, type FlightOrder } from "./types.js"

const offer: FlightOffer = {
  offerId: "offer_1",
  source: "test",
  itineraries: [
    {
      segments: [
        {
          segmentId: "seg_1",
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
      baseFare: { amount: "500.00", currency: "USD" },
      taxes: { amount: "100.00", currency: "USD" },
      total: { amount: "600.00", currency: "USD" },
    },
  ],
  totalPrice: { amount: "600.00", currency: "USD" },
}

const order: FlightOrder = {
  orderId: "order_1",
  pnr: "ABC123",
  status: "ticketed",
  offer,
  passengers: [
    {
      passengerId: "pax_1",
      type: "adult",
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1980-01-01",
    },
  ],
  totalPrice: offer.totalPrice,
  createdAt: "2026-10-01T10:00:00Z",
}

function makeCoreAdapter(): FlightConnectorAdapter {
  return {
    capabilities: { provider: "core", declared: [] },
    async searchFlights() {
      return { offers: [offer] }
    },
    async priceOffer() {
      return { offer, valid: true }
    },
    async bookFlight() {
      return { order }
    },
    async getOrder() {
      return { order }
    },
    async cancelOrder() {
      return { order: { ...order, status: "cancelled" } }
    },
  }
}

describe("FlightConnectorAdapter contract", () => {
  it("allows core-only adapters to omit every optional capability method", async () => {
    const adapter = makeCoreAdapter()

    await expect(adapter.searchFlights({ connectionId: "conn" }, {} as never)).resolves.toEqual({
      offers: [offer],
    })
    expect(adapter.selectSeats).toBeUndefined()
    expect(adapter.checkIn).toBeUndefined()
    expect(adapter.modifyOrder).toBeUndefined()
    expect(adapter.refundOrder).toBeUndefined()
    expect(adapter.voidOrder).toBeUndefined()
    expect(adapter.addSpecialServiceRequest).toBeUndefined()
  })

  it("allows adapters to implement every declared capability method", async () => {
    const adapter: FlightConnectorAdapter = {
      ...makeCoreAdapter(),
      capabilities: {
        provider: "full",
        declared: Object.values(FLIGHT_CAPABILITIES),
      },
      async listOrders() {
        return { orders: [order], pagination: { total: 1, hasMore: false } }
      },
      async ticketOrder() {
        return { order }
      },
      async getAncillaries() {
        return { catalog: { baggage: [], assistance: [], extras: [] } }
      },
      async getSeatMap() {
        return {
          seatMap: {
            segmentId: "seg_1",
            cabin: "economy",
            columnLayout: ["A", "B", "C", null, "D", "E", "F"],
            rows: [],
          },
        }
      },
      async selectSeats(_ctx, request) {
        return { order, selections: request.selections }
      },
      async checkIn() {
        return { order, status: "checked_in", boardingPasses: [] }
      },
      async modifyOrder() {
        return { order, priceDifference: { amount: "0.00", currency: "USD" } }
      },
      async refundOrder() {
        return { order: { ...order, status: "cancelled" }, refundedAmount: order.totalPrice }
      },
      async voidOrder() {
        return { order: { ...order, status: "cancelled" }, voidedAt: "2026-10-01T11:00:00Z" }
      },
      async addSpecialServiceRequest() {
        return { order, status: "requested" }
      },
    }

    await expect(
      adapter.selectSeats?.({ connectionId: "conn" }, { orderId: order.orderId, selections: [] }),
    ).resolves.toEqual({ order, selections: [] })
    await expect(
      adapter.refundOrder?.({ connectionId: "conn" }, { orderId: order.orderId }),
    ).resolves.toEqual({
      order: { ...order, status: "cancelled" },
      refundedAmount: order.totalPrice,
    })
  })

  it("types the new adapter context fields as optional runtime signals", () => {
    const controller = new AbortController()
    const loggerMessages: string[] = []
    const context: FlightAdapterContext = {
      connectionId: "conn",
      requestId: "req_1",
      correlationId: "corr_1",
      idempotencyKey: "idem_1",
      environment: "sandbox",
      signal: controller.signal,
      logger: {
        debug: (message) => loggerMessages.push(message),
        info: (message) => loggerMessages.push(message),
        warn: (message) => loggerMessages.push(message),
        error: (message) => loggerMessages.push(message),
      },
    }

    context.logger?.info("context ready")

    expect(context.requestId).toBe("req_1")
    expect(context.signal).toBe(controller.signal)
    expect(loggerMessages).toEqual(["context ready"])
  })

  it.each([
    [FLIGHT_CAPABILITIES.SEAT_SELECTION, "selectSeats"],
    [FLIGHT_CAPABILITIES.CHECKIN, "checkIn"],
    [FLIGHT_CAPABILITIES.EXCHANGE, "modifyOrder"],
    [FLIGHT_CAPABILITIES.REFUND, "refundOrder"],
    [FLIGHT_CAPABILITIES.VOID, "voidOrder"],
    [FLIGHT_CAPABILITIES.SSR, "addSpecialServiceRequest"],
  ] as const)("throws the standard not-supported error for %s", (capability, operation) => {
    expect(() =>
      requireCapability({ provider: "core", declared: [] }, capability, operation),
    ).toThrow(FlightCapabilityNotSupportedError)

    try {
      requireCapability({ provider: "core", declared: [] }, capability, operation)
    } catch (error) {
      expect(error).toMatchObject({ provider: "core", capability, operation })
    }
  })
})
