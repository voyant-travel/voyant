import { Hono } from "hono"
import type { Env } from "./routes-shared.js"

export const financeBookingReadRoutes = new Hono<Env>()

  // ========================================================================
  // Booking-scoped reads (admin)
  // ========================================================================
  // Mirror the customer-portal's `/v1/public/finance/bookings/:bookingId/payments`
  // endpoint on the admin surface. The admin actor guard
  // (`requireActor("staff")`) blocks staff sessions from hitting the
  // public path, but operators absolutely need to see the canonical
  // `payments` rows on the booking detail page. This handler reuses
  // the same publicFinanceService helper so the response shape is
  // identical to the customer-portal flow.
  .get("/bookings/:bookingId/payments", async (c) => {
    const { publicFinanceService } = await import("./service-public.js")
    const result = await publicFinanceService.getBookingPayments(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!result) {
      return c.json({ error: "Booking payments not found" }, 404)
    }
    return c.json({ data: result })
  })
