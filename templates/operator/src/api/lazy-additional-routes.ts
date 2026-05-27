import type { Context, Hono } from "hono"

type OperatorContext = Context
type OperatorHandler = (c: OperatorContext) => Response | Promise<Response>

function lazy(load: () => Promise<OperatorHandler>): OperatorHandler {
  return async (c) => (await load())(c)
}

function loadPaymentRoutes() {
  return import("./payment-link-routes")
}

export function mountOperatorLazyAdditionalRoutes(hono: Hono): void {
  hono.get(
    "/v1/public/payment-link-config",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkConfig),
  )
  hono.post(
    "/v1/public/payment-link/:sessionId/retry",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkRetry),
  )
  hono.get(
    "/v1/public/payment-link/resolve",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkResolve),
  )
  hono.post(
    "/v1/public/payment-link/:sessionId/start-card",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkStartCard),
  )
  hono.get(
    "/v1/public/payment-link/:sessionId/trip-summary",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkTripSummary),
  )
  hono.get(
    "/v1/public/payment-link/:sessionId/booking-summary",
    lazy(async () => (await loadPaymentRoutes()).handlePaymentLinkBookingSummary),
  )
  hono.get(
    "/v1/public/bookings/:bookingId/checkout-status",
    lazy(async () => (await loadPaymentRoutes()).handleBookingCheckoutStatus),
  )
}
