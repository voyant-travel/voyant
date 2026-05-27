import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountOperatorLazyAdditionalRoutes } from "./lazy-additional-routes"

const handlers = vi.hoisted(() => ({
  handlePaymentLinkConfig: vi.fn((c) => c.json({ route: "config" })),
  handlePaymentLinkRetry: vi.fn((c) => c.json({ route: "retry" })),
  handlePaymentLinkResolve: vi.fn((c) => c.json({ route: "resolve" })),
  handlePaymentLinkStartCard: vi.fn((c) => c.json({ route: "start-card" })),
  handlePaymentLinkTripSummary: vi.fn((c) => c.json({ route: "trip-summary" })),
  handlePaymentLinkBookingSummary: vi.fn((c) => c.json({ route: "booking-summary" })),
  handleBookingCheckoutStatus: vi.fn((c) => c.json({ route: "checkout-status" })),
}))

vi.mock("./payment-link-routes", () => handlers)

describe("operator lazy additional routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not invoke payment-link handlers during route registration", () => {
    const app = new Hono()

    mountOperatorLazyAdditionalRoutes(app)

    expect(handlers.handlePaymentLinkConfig).not.toHaveBeenCalled()
    expect(handlers.handlePaymentLinkRetry).not.toHaveBeenCalled()
    expect(handlers.handlePaymentLinkStartCard).not.toHaveBeenCalled()
  })

  it("dispatches payment-link routes through the lazy handler", async () => {
    const app = new Hono()
    mountOperatorLazyAdditionalRoutes(app)

    const response = await app.request("/v1/public/payment-link/sess_123/start-card", {
      method: "POST",
    })

    await expect(response.json()).resolves.toEqual({ route: "start-card" })
    expect(handlers.handlePaymentLinkStartCard).toHaveBeenCalledOnce()
  })

  it("dispatches checkout-status through the lazy handler", async () => {
    const app = new Hono()
    mountOperatorLazyAdditionalRoutes(app)

    const response = await app.request("/v1/public/bookings/bk_123/checkout-status")

    await expect(response.json()).resolves.toEqual({ route: "checkout-status" })
    expect(handlers.handleBookingCheckoutStatus).toHaveBeenCalledOnce()
  })
})
