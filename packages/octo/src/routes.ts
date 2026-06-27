/**
 * OCTo connectivity routes — the OCTo-shaped (Open Connectivity for Tours &
 * Activities) projection surface: read-only product/availability projections
 * plus the reseller booking lifecycle (reserve / confirm / extend-hold / expire
 * / cancel) and ticket redemption.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI backfill (voyant#2114 — octo
 * sub-batch) via a NON-BREAKING dual-mount: the same `OpenAPIHono` instance is
 * exported as `octoRoutes` and mounted by the framework on BOTH the legacy
 * `/v1/octo/*` surface (for back-compat) AND the documented partner surface at
 * `/v1/public/octo/*` (OCTo is a connectivity API consumed by resellers /
 * suppliers, not a staff admin dashboard — see `index.ts`). Request schemas
 * reuse the exported `validation.ts` query schemas and the `bookings` package
 * action schemas the handlers already parsed; response projection schemas live
 * in `routes/openapi-schemas.ts`. Business logic is unchanged; handlers read
 * `c.req.valid(...)` instead of `parseQuery`/`parseJsonBody`.
 *
 * Each resource family is its own small `OpenAPIHono` sub-chain composed onto
 * the parent via `.route("/")` so the `.openapi()` operations propagate up while
 * keeping type-inference cost bounded (one flat chain has O(n²) inference cost).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  cancelBookingSchema,
  confirmBookingSchema,
  expireBookingSchema,
  extendBookingHoldSchema,
  recordBookingRedemptionSchema,
  reserveBookingSchema,
} from "@voyant-travel/bookings"
import { openApiValidationHook } from "@voyant-travel/hono"

import type { OctoRouteEnv } from "./routes/env.js"
import {
  calendarEnvelopeSchema,
  errorResponseSchema,
  idParamSchema,
  listEnvelopeSchema,
  octoAvailabilityCalendarDaySchema,
  octoAvailabilitySchema,
  octoBookingSchema,
  octoProductSchema,
  octoRedemptionEventSchema,
} from "./routes/openapi-schemas.js"
import { octoService } from "./service.js"
import {
  octoAvailabilityCalendarQuerySchema,
  octoAvailabilityListQuerySchema,
  octoBookingListQuerySchema,
  octoProductListQuerySchema,
} from "./validation.js"

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

// --- products ---------------------------------------------------------------

const listProductsRoute = createRoute({
  method: "get",
  path: "/products",
  tags: ["OCTo Products"],
  summary: "List OCTo-projected products",
  request: { query: octoProductListQuerySchema },
  responses: {
    200: {
      description: "Paginated OCTo products",
      ...jsonContent(listEnvelopeSchema(octoProductSchema)),
    },
  },
})

const getProductRoute = createRoute({
  method: "get",
  path: "/products/{id}",
  tags: ["OCTo Products"],
  summary: "Get an OCTo-projected product by id",
  request: { params: idParamSchema },
  responses: {
    200: { description: "An OCTo product", ...jsonContent(z.object({ data: octoProductSchema })) },
    404: { description: "Product not found", ...jsonContent(errorResponseSchema) },
  },
})

const getProductAvailabilityRoute = createRoute({
  method: "get",
  path: "/products/{id}/availability",
  tags: ["OCTo Products"],
  summary: "List availability slots for a product",
  request: { params: idParamSchema, query: octoAvailabilityListQuerySchema },
  responses: {
    200: {
      description: "Paginated availability slots",
      ...jsonContent(listEnvelopeSchema(octoAvailabilitySchema)),
    },
  },
})

const getProductCalendarRoute = createRoute({
  method: "get",
  path: "/products/{id}/calendar",
  tags: ["OCTo Products"],
  summary: "Aggregated per-day availability calendar for a product",
  request: { params: idParamSchema, query: octoAvailabilityCalendarQuerySchema },
  responses: {
    200: {
      description: "Aggregated daily availability",
      ...jsonContent(calendarEnvelopeSchema(octoAvailabilityCalendarDaySchema)),
    },
  },
})

const productRoutes = new OpenAPIHono<OctoRouteEnv>({ defaultHook: openApiValidationHook })
  .openapi(listProductsRoute, async (c) =>
    c.json(await octoService.listProjectedProducts(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getProductRoute, async (c) => {
    const row = await octoService.getProjectedProductById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Product not found" }, 404)
  })
  .openapi(getProductAvailabilityRoute, async (c) =>
    c.json(
      await octoService.listProjectedAvailability(c.get("db"), {
        ...c.req.valid("query"),
        productId: c.req.valid("param").id,
      }),
      200,
    ),
  )
  .openapi(getProductCalendarRoute, async (c) =>
    c.json(
      await octoService.getProjectedAvailabilityCalendar(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("query"),
      ),
      200,
    ),
  )

// --- availability -----------------------------------------------------------

const listAvailabilityRoute = createRoute({
  method: "get",
  path: "/availability",
  tags: ["OCTo Availability"],
  summary: "List OCTo-projected availability slots",
  request: { query: octoAvailabilityListQuerySchema },
  responses: {
    200: {
      description: "Paginated availability slots",
      ...jsonContent(listEnvelopeSchema(octoAvailabilitySchema)),
    },
  },
})

const getAvailabilityRoute = createRoute({
  method: "get",
  path: "/availability/{id}",
  tags: ["OCTo Availability"],
  summary: "Get an availability slot by id",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An availability slot",
      ...jsonContent(z.object({ data: octoAvailabilitySchema })),
    },
    404: { description: "Availability not found", ...jsonContent(errorResponseSchema) },
  },
})

const availabilityRoutes = new OpenAPIHono<OctoRouteEnv>({ defaultHook: openApiValidationHook })
  .openapi(listAvailabilityRoute, async (c) =>
    c.json(await octoService.listProjectedAvailability(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getAvailabilityRoute, async (c) => {
    const row = await octoService.getProjectedAvailabilityById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Availability not found" }, 404)
  })

// --- bookings ---------------------------------------------------------------

const reserveBookingRoute = createRoute({
  method: "post",
  path: "/bookings",
  tags: ["OCTo Bookings"],
  summary: "Reserve (hold) an OCTo booking",
  request: requiredJsonBody(reserveBookingSchema),
  responses: {
    201: {
      description: "The reserved booking",
      ...jsonContent(z.object({ data: octoBookingSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Availability slot not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Slot conflict", ...jsonContent(errorResponseSchema) },
  },
})

const listBookingsRoute = createRoute({
  method: "get",
  path: "/bookings",
  tags: ["OCTo Bookings"],
  summary: "List OCTo-projected bookings",
  request: { query: octoBookingListQuerySchema },
  responses: {
    200: {
      description: "Paginated OCTo bookings",
      ...jsonContent(listEnvelopeSchema(octoBookingSchema)),
    },
  },
})

const getBookingRoute = createRoute({
  method: "get",
  path: "/bookings/{id}",
  tags: ["OCTo Bookings"],
  summary: "Get an OCTo-projected booking by id",
  request: { params: idParamSchema },
  responses: {
    200: { description: "An OCTo booking", ...jsonContent(z.object({ data: octoBookingSchema })) },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
  },
})

const confirmBookingRoute = createRoute({
  method: "post",
  path: "/bookings/{id}/confirm",
  tags: ["OCTo Bookings"],
  summary: "Confirm a held OCTo booking",
  request: { params: idParamSchema, ...requiredJsonBody(confirmBookingSchema) },
  responses: {
    200: {
      description: "The confirmed booking",
      ...jsonContent(z.object({ data: octoBookingSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Invalid booking status transition", ...jsonContent(errorResponseSchema) },
  },
})

const extendBookingHoldRoute = createRoute({
  method: "post",
  path: "/bookings/{id}/extend-hold",
  tags: ["OCTo Bookings"],
  summary: "Extend the hold window on an OCTo booking",
  request: { params: idParamSchema, ...requiredJsonBody(extendBookingHoldSchema) },
  responses: {
    200: {
      description: "The booking with an extended hold",
      ...jsonContent(z.object({ data: octoBookingSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Invalid booking status transition", ...jsonContent(errorResponseSchema) },
  },
})

const expireBookingRoute = createRoute({
  method: "post",
  path: "/bookings/{id}/expire",
  tags: ["OCTo Bookings"],
  summary: "Expire an OCTo booking",
  request: { params: idParamSchema, ...requiredJsonBody(expireBookingSchema) },
  responses: {
    200: {
      description: "The expired booking",
      ...jsonContent(z.object({ data: octoBookingSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Invalid booking status transition", ...jsonContent(errorResponseSchema) },
  },
})

const cancelBookingRoute = createRoute({
  method: "post",
  path: "/bookings/{id}/cancel",
  tags: ["OCTo Bookings"],
  summary: "Cancel an OCTo booking",
  request: { params: idParamSchema, ...requiredJsonBody(cancelBookingSchema) },
  responses: {
    200: {
      description: "The cancelled booking",
      ...jsonContent(z.object({ data: octoBookingSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Invalid booking status transition", ...jsonContent(errorResponseSchema) },
  },
})

const listRedemptionsRoute = createRoute({
  method: "get",
  path: "/bookings/{id}/redemptions",
  tags: ["OCTo Bookings"],
  summary: "List redemption events for an OCTo booking",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Redemption events for the booking",
      ...jsonContent(z.object({ data: z.array(octoRedemptionEventSchema) })),
    },
    404: { description: "Booking not found", ...jsonContent(errorResponseSchema) },
  },
})

const redeemBookingRoute = createRoute({
  method: "post",
  path: "/bookings/{id}/redeem",
  tags: ["OCTo Bookings"],
  summary: "Record a ticket redemption against an OCTo booking",
  request: { params: idParamSchema, ...requiredJsonBody(recordBookingRedemptionSchema) },
  responses: {
    201: {
      description: "The recorded redemption event and the updated booking",
      ...jsonContent(
        z.object({ data: octoRedemptionEventSchema, booking: octoBookingSchema.nullable() }),
      ),
    },
    404: {
      description: "Booking, item, or participant not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const bookingRoutes = new OpenAPIHono<OctoRouteEnv>({ defaultHook: openApiValidationHook })
  .openapi(reserveBookingRoute, async (c) => {
    const result = await octoService.reserveProjectedBooking(
      c.get("db"),
      c.req.valid("json"),
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
  .openapi(listBookingsRoute, async (c) =>
    c.json(await octoService.listProjectedBookings(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getBookingRoute, async (c) => {
    const row = await octoService.getProjectedBookingById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Booking not found" }, 404)
  })
  .openapi(confirmBookingRoute, async (c) => {
    const result = await octoService.confirmProjectedBooking(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking }, 200)
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    if (result.status === "hold_expired") return c.json({ error: "Booking hold has expired" }, 409)
    return c.json({ error: "Unable to confirm booking" }, 400)
  })
  .openapi(extendBookingHoldRoute, async (c) => {
    const result = await octoService.extendProjectedBookingHold(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking }, 200)
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    if (result.status === "hold_expired") return c.json({ error: "Booking hold has expired" }, 409)
    return c.json({ error: "Unable to extend booking hold" }, 400)
  })
  .openapi(expireBookingRoute, async (c) => {
    const result = await octoService.expireProjectedBooking(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking }, 200)
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    return c.json({ error: "Unable to expire booking" }, 400)
  })
  .openapi(cancelBookingRoute, async (c) => {
    const result = await octoService.cancelProjectedBooking(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("userId"),
    )

    if ("booking" in result && result.booking) return c.json({ data: result.booking }, 200)
    if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
    if (result.status === "invalid_transition")
      return c.json({ error: "Invalid booking status transition" }, 409)
    return c.json({ error: "Unable to cancel booking" }, 400)
  })
  .openapi(listRedemptionsRoute, async (c) => {
    const booking = await octoService.getProjectedBookingById(c.get("db"), c.req.valid("param").id)
    if (!booking) return c.json({ error: "Booking not found" }, 404)

    return c.json(
      { data: await octoService.listProjectedRedemptions(c.get("db"), c.req.valid("param").id) },
      200,
    )
  })
  .openapi(redeemBookingRoute, async (c) => {
    const result = await octoService.recordProjectedRedemption(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("userId"),
    )

    if (!result) {
      return c.json({ error: "Booking, item, or participant not found" }, 404)
    }

    return c.json({ data: result.event, booking: result.booking }, 201)
  })

export const octoRoutes = new OpenAPIHono<OctoRouteEnv>({ defaultHook: openApiValidationHook })
  .route("/", productRoutes)
  .route("/", availabilityRoutes)
  .route("/", bookingRoutes)

export type OctoRoutes = typeof octoRoutes
