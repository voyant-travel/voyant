import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import type { FlightConnectorAdapter } from "./contract/adapter.js"
import {
  createFlightAdminRoutes,
  createFlightsHonoModule,
  type FlightPaymentIntegration,
} from "./hono.js"

function stubAdapter(over: Partial<FlightConnectorAdapter> = {}): FlightConnectorAdapter {
  return {
    capabilities: { provider: "stub", declared: [] },
    searchFlights: vi.fn(async () => ({ offers: [] })),
    priceOffer: vi.fn(async () => ({ offer: {} as never, valid: true })),
    bookFlight: vi.fn(async () => ({ order: { orderId: "ord_1", passengers: [] } as never })),
    getOrder: vi.fn(async () => ({ order: { orderId: "ord_1", passengers: [] } as never })),
    cancelOrder: vi.fn(async () => ({ order: { orderId: "ord_1" } as never })),
    ...over,
  }
}

function mount(adapter: FlightConnectorAdapter, payment?: FlightPaymentIntegration) {
  return new Hono().route(
    "/v1/admin/flights",
    createFlightAdminRoutes({ resolveAdapter: () => adapter, payment }),
  )
}

describe("flights hono module", () => {
  it("createFlightsHonoModule exposes adminRoutes on module 'flights'", () => {
    const mod = createFlightsHonoModule({ resolveAdapter: () => stubAdapter() })
    expect(mod.module.name).toBe("flights")
    expect(mod.adminRoutes).toBeDefined()
  })

  it("POST /search delegates to the resolved adapter", async () => {
    const adapter = stubAdapter()
    const app = mount(adapter)
    const res = await app.request("/v1/admin/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slices: [{}], passengers: { adults: 1 } }),
    })
    expect(res.status).toBe(200)
    expect(adapter.searchFlights).toHaveBeenCalledTimes(1)
  })

  it("POST /search validates required fields", async () => {
    const app = mount(stubAdapter())
    const res = await app.request("/v1/admin/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passengers: { adults: 1 } }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 501 when the connector lacks an optional capability", async () => {
    const app = mount(stubAdapter())
    const res = await app.request("/v1/admin/flights/ancillaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "off_1" }),
    })
    expect(res.status).toBe(501)
  })

  it("creates and attaches a bank-transfer payment session during booking", async () => {
    const adapter = stubAdapter()
    const payment: FlightPaymentIntegration = {
      ensureOrderSession: vi.fn(async () => ({ sessionId: "ps_bank", status: "pending" })),
      fetchOrderSessions: vi.fn(async () => new Map()),
    }
    const app = mount(adapter, payment)

    const res = await app.request("/v1/admin/flights/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: "off_1",
        passengers: [{ passengerId: "p1" }],
        contact: { email: "payer@example.com" },
        paymentIntent: { type: "bank_transfer" },
      }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      order: {
        providerData: {
          paymentSessionId: "ps_bank",
          paymentStatus: "pending",
        },
      },
    })
    expect(payment.ensureOrderSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "ord_1" }),
      { email: "payer@example.com" },
      { paymentMethod: "bank_transfer", startCardPayment: false },
    )
    expect(adapter.bookFlight).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentIntent: { type: "hold" } }),
    )
  })

  it("preserves hold payment-session creation during booking", async () => {
    const adapter = stubAdapter()
    const payment: FlightPaymentIntegration = {
      ensureOrderSession: vi.fn(async () => ({ sessionId: "ps_hold", status: "pending" })),
      fetchOrderSessions: vi.fn(async () => new Map()),
    }
    const app = mount(adapter, payment)

    const res = await app.request("/v1/admin/flights/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: "off_1",
        passengers: [{ passengerId: "p1" }],
        paymentIntent: { type: "hold" },
      }),
    })

    expect(res.status).toBe(200)
    expect(payment.ensureOrderSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "ord_1" }),
      undefined,
      { startCardPayment: true },
    )
  })

  it("does not create a payment session for card booking intent", async () => {
    const adapter = stubAdapter()
    const payment: FlightPaymentIntegration = {
      ensureOrderSession: vi.fn(async () => ({ sessionId: "ps_card", status: "pending" })),
      fetchOrderSessions: vi.fn(async () => new Map()),
    }
    const app = mount(adapter, payment)

    const res = await app.request("/v1/admin/flights/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: "off_1",
        passengers: [{ passengerId: "p1" }],
        paymentIntent: { type: "card", token: "tok_1" },
      }),
    })

    expect(res.status).toBe(200)
    expect(payment.ensureOrderSession).not.toHaveBeenCalled()
    expect(adapter.bookFlight).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentIntent: { type: "card", token: "tok_1" } }),
    )
  })
})
