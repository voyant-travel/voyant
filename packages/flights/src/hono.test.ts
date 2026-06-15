import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import type { FlightConnectorAdapter } from "./contract/adapter.js"
import { createFlightAdminRoutes, createFlightsHonoModule } from "./hono.js"

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

function mount(adapter: FlightConnectorAdapter) {
  return new Hono().route(
    "/v1/admin/flights",
    createFlightAdminRoutes({ resolveAdapter: () => adapter }),
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
})
