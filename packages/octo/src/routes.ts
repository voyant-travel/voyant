import {
  cancelBookingSchema,
  confirmBookingSchema,
  expireBookingSchema,
  extendBookingHoldSchema,
  recordBookingRedemptionSchema,
  reserveBookingSchema,
} from "@voyant-travel/bookings"
import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { octoService } from "./service.js"
import {
  octoAvailabilityCalendarQuerySchema,
  octoAvailabilityListQuerySchema,
  octoBookingListQuerySchema,
  octoProductListQuerySchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const octoRoutes = new Hono<Env>()
  .get("/products", async (c) => {
    const query = await parseQuery(c, octoProductListQuerySchema)
    return c.json(await octoService.listProjectedProducts(c.get("db"), query))
  })
  .get("/availability", async (c) => {
    const query = await parseQuery(c, octoAvailabilityListQuerySchema)
    return c.json(await octoService.listProjectedAvailability(c.get("db"), query))
  })
  .get("/products/:id", async (c) => {
    const row = await octoService.getProjectedProductById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Product not found" }, 404)
    return c.json({ data: row })
  })
  .get("/products/:id/availability", async (c) => {
    const query = octoAvailabilityListQuerySchema.parse({
      ...(await parseQuery(c, octoAvailabilityListQuerySchema.partial())),
      productId: c.req.param("id"),
    })
    return c.json(await octoService.listProjectedAvailability(c.get("db"), query))
  })
  .get("/products/:id/calendar", async (c) => {
    const query = await parseQuery(c, octoAvailabilityCalendarQuerySchema)
    return c.json(
      await octoService.getProjectedAvailabilityCalendar(c.get("db"), c.req.param("id"), query),
    )
  })
  .get("/availability/:id", async (c) => {
    const row = await octoService.getProjectedAvailabilityById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Availability not found" }, 404)
    return c.json({ data: row })
  })
  .post("/bookings", async (c) => {
    const result = await octoService.reserveProjectedBooking(
      c.get("db"),
      await parseJsonBody(c, reserveBookingSchema),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) {
      return c.json({ data: result.booking }, 201)
    }
    if (result.status === "slot_not_found")
      return c.json({ error: "Availability slot not found" }, 404)
    if (result.status === "insufficient_capacity")
      return c.json({ error: "Insufficient slot capacity" }, 409)
    if (result.status === "slot_unavailable")
      return c.json({ error: "Availability slot is not bookable" }, 409)
    if (result.status === "slot_product_mismatch" || result.status === "slot_option_mismatch") {
      return c.json({ error: "Reservation item does not match availability slot" }, 409)
    }

    return c.json({ error: "Unable to reserve booking" }, 400)
  })
  .get("/bookings", async (c) => {
    const query = await parseQuery(c, octoBookingListQuerySchema)
    return c.json(await octoService.listProjectedBookings(c.get("db"), query))
  })
  .get("/bookings/:id", async (c) => {
    const row = await octoService.getProjectedBookingById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking not found" }, 404)
    return c.json({ data: row })
  })
  .post("/bookings/:id/confirm", async (c) => {
    const result = await octoService.confirmProjectedBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, confirmBookingSchema),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking })
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    if (result.status === "hold_expired") return c.json({ error: "Booking hold has expired" }, 409)
    return c.json({ error: "Unable to confirm booking" }, 400)
  })
  .post("/bookings/:id/extend-hold", async (c) => {
    const result = await octoService.extendProjectedBookingHold(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, extendBookingHoldSchema),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking })
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    if (result.status === "hold_expired") return c.json({ error: "Booking hold has expired" }, 409)
    return c.json({ error: "Unable to extend booking hold" }, 400)
  })
  .post("/bookings/:id/expire", async (c) => {
    const result = await octoService.expireProjectedBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, expireBookingSchema),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking })
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    return c.json({ error: "Unable to expire booking" }, 400)
  })
  .post("/bookings/:id/cancel", async (c) => {
    const result = await octoService.cancelProjectedBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, cancelBookingSchema),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking })
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    return c.json({ error: "Unable to cancel booking" }, 400)
  })
  .get("/bookings/:id/redemptions", async (c) => {
    const booking = await octoService.getProjectedBookingById(c.get("db"), c.req.param("id"))
    if (!booking) return c.json({ error: "Booking not found" }, 404)

    return c.json({
      data: await octoService.listProjectedRedemptions(c.get("db"), c.req.param("id")),
    })
  })
  .post("/bookings/:id/redeem", async (c) => {
    const result = await octoService.recordProjectedRedemption(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, recordBookingRedemptionSchema),
      c.get("userId"),
    )

    if (!result) {
      return c.json({ error: "Booking, item, or participant not found" }, 404)
    }

    return c.json({ data: result.event, booking: result.booking }, 201)
  })

export type OctoRoutes = typeof octoRoutes
