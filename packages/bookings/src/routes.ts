import {
  ForbiddenApiError,
  handleApiError,
  idempotencyKey,
  normalizeValidationError,
  parseJsonBody,
  parseQuery,
  requireUserId,
  UnauthorizedApiError,
} from "@voyantjs/hono"
import { type Context, Hono } from "hono"

import { createBookingPiiService } from "./pii.js"
import {
  redactBookingContact,
  redactTravelerIdentity,
  shouldRevealBookingPii,
} from "./pii-redaction.js"
import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntime,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
import { bookingGroupRoutes } from "./routes-groups.js"
import type { publicBookingRoutes } from "./routes-public.js"
import type { Env } from "./routes-shared.js"
import { bookingPiiAccessLog } from "./schema.js"
import { bookingsService } from "./service.js"
import { bookingGroupsService } from "./service-groups.js"
import { publicBookingsService, resolveSessionPricingSnapshot } from "./service-public.js"
import {
  bookingAggregatesQuerySchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  completeBookingSchema,
  confirmBookingSchema,
  convertProductSchema,
  createBookingSchema,
  expireBookingSchema,
  expireStaleBookingsSchema,
  extendBookingHoldSchema,
  insertBookingDocumentSchema,
  insertBookingFulfillmentSchema,
  insertBookingItemSchema,
  insertBookingItemTravelerSchema,
  insertBookingNoteSchema,
  insertSupplierStatusSchema,
  insertTravelerSchema,
  internalBookingOverviewLookupQuerySchema,
  overrideBookingStatusSchema,
  pricingPreviewSchema,
  recordBookingRedemptionSchema,
  reserveBookingFromTransactionSchema,
  reserveBookingSchema,
  startBookingSchema,
  updateBookingFulfillmentSchema,
  updateBookingItemSchema,
  updateBookingSchema,
  updateSupplierStatusSchema,
  updateTravelerSchema,
  upsertTravelerTravelDetailsSchema,
} from "./validation.js"

function hasPiiScope(scopes: string[] | null | undefined, action: "read" | "update" | "delete") {
  if (!scopes || scopes.length === 0) {
    return false
  }

  return (
    scopes.includes("*") ||
    scopes.includes("bookings-pii:*") ||
    scopes.includes(`bookings-pii:${action}`)
  )
}

async function logBookingPiiAccess(
  c: Context<Env>,
  input: {
    bookingId?: string
    travelerId?: string
    action: "read" | "update" | "delete"
    outcome: "allowed" | "denied"
    reason?: string
    metadata?: Record<string, unknown>
  },
) {
  await c
    .get("db")
    .insert(bookingPiiAccessLog)
    .values({
      bookingId: input.bookingId ?? null,
      travelerId: input.travelerId ?? null,
      actorId: c.get("userId") ?? null,
      actorType: c.get("actor") ?? null,
      callerType: c.get("callerType") ?? null,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    })
}

async function authorizeBookingPiiAccess(
  c: Context<Env>,
  input: {
    bookingId: string
    travelerId: string
    action: "read" | "update" | "delete"
  },
) {
  if (c.get("isInternalRequest")) {
    return { allowed: true as const }
  }

  const userId = c.get("userId")
  if (!userId) {
    await logBookingPiiAccess(c, {
      ...input,
      outcome: "denied",
      reason: "missing_user",
    })
    return {
      allowed: false as const,
      response: handleApiError(new UnauthorizedApiError(), c),
    }
  }

  const customAuthorizer = c.get("authorizeBookingPii")
  if (customAuthorizer) {
    const allowed = await customAuthorizer({
      db: c.get("db"),
      userId,
      actor: c.get("actor"),
      callerType: c.get("callerType"),
      scopes: c.get("scopes"),
      isInternalRequest: c.get("isInternalRequest"),
      ...input,
    })

    if (!allowed) {
      await logBookingPiiAccess(c, {
        ...input,
        outcome: "denied",
        reason: "custom_policy_denied",
      })
      return {
        allowed: false as const,
        response: handleApiError(new ForbiddenApiError(), c),
      }
    }

    return { allowed: true as const }
  }

  const actor = c.get("actor")
  const scopes = c.get("scopes")
  const allowed = hasPiiScope(scopes, input.action) || actor === "staff"

  if (!allowed) {
    await logBookingPiiAccess(c, {
      ...input,
      outcome: "denied",
      reason: "insufficient_scope",
      metadata: { actor: actor ?? null },
    })
    return {
      allowed: false as const,
      response: handleApiError(new ForbiddenApiError(), c),
    }
  }

  return { allowed: true as const }
}

function handleKmsConfigError(c: Context<Env>, error: unknown) {
  if (error instanceof Error) {
    return c.json(
      {
        error: "Booking PII encryption is not configured",
        details: error.message,
      },
      500,
    )
  }

  return c.json({ error: "Booking PII encryption is not configured" }, 500)
}

function getRouteRuntime(c: Context<Env>): BookingRouteRuntime {
  try {
    return (
      c.var.container?.resolve<BookingRouteRuntime>(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) ??
      buildBookingRouteRuntime(c.env)
    )
  } catch {
    return buildBookingRouteRuntime(c.env)
  }
}

async function createAuditedBookingPiiService(c: Context<Env>, bookingId: string) {
  const runtime = getRouteRuntime(c)
  const kms = await runtime.getKmsProvider()

  return createBookingPiiService({
    kms,
    onAudit: async (event) => {
      await logBookingPiiAccess(c, {
        bookingId,
        travelerId: event.travelerId,
        action:
          event.action === "encrypt"
            ? "update"
            : event.action === "decrypt"
              ? "read"
              : event.action,
        outcome: "allowed",
      })
    },
  })
}

// ==========================================================================
// Bookings — method-chained for Hono RPC type inference
// ==========================================================================

export const bookingRoutes = new Hono<Env>()

  // ==========================================================================
  // Bookings CRUD
  // ==========================================================================

  // 1. GET / — List bookings
  .get("/", async (c) => {
    const query = parseQuery(c, bookingListQuerySchema)
    const result = await bookingsService.listBookings(c.get("db"), query)
    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
    })
    await logBookingPiiAccess(c, {
      action: "read",
      outcome: "allowed",
      reason: reveal ? "list_reveal" : "list_redacted",
      metadata: { rowCount: result.data.length, reveal },
    })
    if (reveal) return c.json(result)
    return c.json({
      ...result,
      data: result.data.map((row) => redactBookingContact(row)),
    })
  })

  // 1a. POST /pricing-preview — Resolve a pricing snapshot without creating a session.
  .post("/pricing-preview", async (c) => {
    const body = await parseJsonBody(c, pricingPreviewSchema)
    const snapshot = await resolveSessionPricingSnapshot(c.get("db"), body.productId, {
      optionId: body.optionId ?? undefined,
      catalogId: body.catalogId ?? undefined,
    })
    if (!snapshot) {
      return c.json({ error: "Pricing unavailable for this selection" }, 404)
    }
    return c.json({ data: snapshot })
  })

  // 1b. GET /aggregates — Pre-aggregated dashboard metrics
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, bookingAggregatesQuerySchema)
    return c.json({ data: await bookingsService.getBookingAggregates(c.get("db"), query) })
  })

  // 1b. GET /overview — Internal/admin booking overview lookup
  .get("/overview", async (c) => {
    const overview = await publicBookingsService.getOverviewByLookup(
      c.get("db"),
      parseQuery(c, internalBookingOverviewLookupQuerySchema),
    )

    if (!overview) {
      return c.json({ error: "Booking overview not found" }, 404)
    }

    return c.json({ data: overview })
  })

  // 2. GET /:id — Get single booking
  .get("/:id", async (c) => {
    const row = await bookingsService.getBookingById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
    })
    await logBookingPiiAccess(c, {
      bookingId: row.id,
      action: "read",
      outcome: "allowed",
      reason: reveal ? "detail_reveal" : "detail_redacted",
      metadata: { reveal },
    })
    return c.json({ data: reveal ? row : redactBookingContact(row) })
  })

  // 3. POST /reserve — Reserve inventory and create on-hold booking
  .post("/reserve", idempotencyKey({ scope: "POST /v1/admin/bookings/reserve" }), async (c) => {
    const result = await bookingsService.reserveBooking(
      c.get("db"),
      await parseJsonBody(c, reserveBookingSchema),
      c.get("userId"),
    )

    if ("booking" in result) {
      return c.json({ data: result.booking }, 201)
    }

    if (result.status === "slot_not_found") {
      return c.json({ error: "Availability slot not found" }, 404)
    }

    if (result.status === "insufficient_capacity") {
      return c.json({ error: "Insufficient slot capacity" }, 409)
    }

    if (result.status === "slot_unavailable") {
      return c.json({ error: "Availability slot is not bookable" }, 409)
    }

    if (result.status === "slot_product_mismatch" || result.status === "slot_option_mismatch") {
      return c.json({ error: "Reservation item does not match availability slot" }, 409)
    }

    return c.json({ error: "Unable to reserve booking" }, 400)
  })

  // 3a. POST /from-product — Create booking draft from product definition
  .post(
    "/from-product",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-product" }),
    async (c) => {
      const row = await bookingsService.createBookingFromProduct(
        c.get("db"),
        await parseJsonBody(c, convertProductSchema),
        c.get("userId"),
      )

      if (!row) {
        return c.json({ error: "Product or option not found" }, 404)
      }

      return c.json({ data: row }, 201)
    },
  )

  // 3b. POST /from-offer/:offerId/reserve — Reserve booking from transaction offer
  .post(
    "/from-offer/:offerId/reserve",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-offer" }),
    async (c) => {
      const result = await bookingsService.reserveBookingFromOffer(
        c.get("db"),
        c.req.param("offerId"),
        await parseJsonBody(c, reserveBookingFromTransactionSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return c.json({ error: "Offer not found" }, 404)
      }

      if (result.status === "slot_not_found") {
        return c.json({ error: "Availability slot not found" }, 404)
      }

      if (result.status === "insufficient_capacity") {
        return c.json({ error: "Insufficient slot capacity" }, 409)
      }

      if (result.status === "slot_unavailable") {
        return c.json({ error: "Availability slot is not bookable" }, 409)
      }

      if (result.status === "slot_product_mismatch" || result.status === "slot_option_mismatch") {
        return c.json({ error: "Reservation item does not match availability slot" }, 409)
      }

      if ("booking" in result) {
        return c.json({ data: result.booking }, 201)
      }

      return c.json({ error: "Unable to reserve booking from offer" }, 400)
    },
  )

  // 3c. POST /from-order/:orderId/reserve — Reserve booking from transaction order
  .post(
    "/from-order/:orderId/reserve",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-order" }),
    async (c) => {
      const result = await bookingsService.reserveBookingFromOrder(
        c.get("db"),
        c.req.param("orderId"),
        await parseJsonBody(c, reserveBookingFromTransactionSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return c.json({ error: "Order not found" }, 404)
      }

      if (result.status === "slot_not_found") {
        return c.json({ error: "Availability slot not found" }, 404)
      }

      if (result.status === "insufficient_capacity") {
        return c.json({ error: "Insufficient slot capacity" }, 409)
      }

      if (result.status === "slot_unavailable") {
        return c.json({ error: "Availability slot is not bookable" }, 409)
      }

      if (result.status === "slot_product_mismatch" || result.status === "slot_option_mismatch") {
        return c.json({ error: "Reservation item does not match availability slot" }, 409)
      }

      if ("booking" in result) {
        return c.json({ data: result.booking }, 201)
      }

      return c.json({ error: "Unable to reserve booking from order" }, 400)
    },
  )

  // 4. POST / — Create booking (manual/backoffice only)
  .post("/", idempotencyKey({ scope: "POST /v1/admin/bookings" }), async (c) => {
    try {
      return c.json(
        {
          data: await bookingsService.createBooking(
            c.get("db"),
            await parseJsonBody(c, createBookingSchema, {
              invalidBodyMessage: "Invalid booking create payload",
            }),
            c.get("userId"),
          ),
        },
        201,
      )
    } catch (error) {
      const validationError = normalizeValidationError(error)

      if (validationError?.status === 400) {
        return c.json(
          {
            error: validationError.message,
            details: validationError.details?.fields ?? validationError.details,
          },
          400,
        )
      }

      throw error
    }
  })

  // 5. PATCH /:id — Update booking
  .patch("/:id", async (c) => {
    const row = await bookingsService.updateBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row })
  })

  // 6. DELETE /:id — Delete booking
  .delete("/:id", async (c) => {
    const row = await bookingsService.deleteBooking(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Status
  // ==========================================================================

  // 8. POST /:id/confirm — Confirm an on-hold booking
  .post("/:id/confirm", async (c) => {
    const result = await bookingsService.confirmBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, confirmBookingSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus") },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "hold_expired") {
      return c.json({ error: "Booking hold has expired" }, 409)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to confirm booking" }, 400)
  })

  // 9. POST /:id/extend-hold — Extend booking hold expiry
  .post("/:id/extend-hold", async (c) => {
    const result = await bookingsService.extendBookingHold(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, extendBookingHoldSchema),
      c.get("userId"),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "hold_expired") {
      return c.json({ error: "Booking hold has expired" }, 409)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to extend booking hold" }, 400)
  })

  // 10. POST /:id/expire — Expire an on-hold booking
  .post("/:id/expire", async (c) => {
    const result = await bookingsService.expireBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, expireBookingSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus"), cause: "route" },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to expire booking" }, 400)
  })

  // 10b. POST /expire-stale — Expire all stale on-hold bookings up to a cutoff
  .post("/expire-stale", async (c) => {
    return c.json(
      await bookingsService.expireStaleBookings(
        c.get("db"),
        await parseJsonBody(c, expireStaleBookingsSchema),
        c.get("userId"),
        { eventBus: c.get("eventBus") },
      ),
    )
  })

  // 11. POST /:id/cancel — Cancel a booking and release allocations
  .post("/:id/cancel", async (c) => {
    const result = await bookingsService.cancelBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, cancelBookingSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus") },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking cannot be cancelled from its current state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to cancel booking" }, 400)
  })

  // 11a. POST /:id/start — Mark a confirmed booking as in-progress
  .post("/:id/start", async (c) => {
    const result = await bookingsService.startBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, startBookingSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus") },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in a confirmed state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to start booking" }, 400)
  })

  // 11b. POST /:id/complete — Mark an in-progress booking as completed
  .post("/:id/complete", async (c) => {
    const result = await bookingsService.completeBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, completeBookingSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus") },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an in-progress state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to complete booking" }, 400)
  })

  // 11c. POST /:id/override-status — Admin override that bypasses the
  // transition graph. Updates the booking row only — no cascade to items,
  // allocations, or fulfillments. Always emits booking.status_overridden for
  // audit. Requires a non-empty `reason`.
  .post("/:id/override-status", async (c) => {
    const result = await bookingsService.overrideBookingStatus(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, overrideBookingStatusSchema),
      c.get("userId"),
      { eventBus: c.get("eventBus") },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to override booking status" }, 400)
  })

  // 12. GET /:id/allocations — List booking allocations
  .get("/:id/allocations", async (c) => {
    return c.json({ data: await bookingsService.listAllocations(c.get("db"), c.req.param("id")) })
  })

  // ==========================================================================
  // Travelers
  // ==========================================================================

  .get("/:id/travelers", async (c) => {
    const travelers = await bookingsService.listTravelers(c.get("db"), c.req.param("id"))
    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
    })
    await logBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      action: "read",
      outcome: "allowed",
      reason: reveal ? "travelers_reveal" : "travelers_redacted",
      metadata: { rowCount: travelers.length, reveal },
    })
    if (reveal) return c.json({ data: travelers })
    return c.json({ data: travelers.map((row) => redactTravelerIdentity(row)) })
  })

  .get("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "read",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "read",
        outcome: "denied",
        reason: "participant_not_found",
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const details = await pii.getTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId"))

      if (!details) {
        await logBookingPiiAccess(c, {
          bookingId: traveler.bookingId,
          travelerId: traveler.id,
          action: "read",
          outcome: "denied",
          reason: "travel_details_not_found",
        })
        return c.json({ error: "Traveler travel details not found" }, 404)
      }

      return c.json({ data: details })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .post("/:id/travelers", async (c) => {
    const row = await bookingsService.createTraveler(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertTravelerSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "update",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "update",
        outcome: "denied",
        reason: "participant_not_found",
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const row = await pii.upsertTravelerTravelDetails(
        c.get("db"),
        traveler.id,
        await parseJsonBody(c, upsertTravelerTravelDetailsSchema),
        c.get("userId"),
      )

      if (!row) {
        return c.json({ error: "Traveler not found" }, 404)
      }

      return c.json({ data: row })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .patch("/:id/travelers/:travelerId", async (c) => {
    const row = await bookingsService.updateTraveler(
      c.get("db"),
      c.req.param("travelerId"),
      await parseJsonBody(c, updateTravelerSchema),
    )

    if (!row) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "delete",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "delete",
        outcome: "denied",
        reason: "participant_not_found",
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const row = await pii.deleteTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId"))

      if (!row) {
        return c.json({ error: "Traveler travel details not found" }, 404)
      }

      return c.json({ success: true }, 200)
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .delete("/:id/travelers/:travelerId", async (c) => {
    const row = await bookingsService.deleteTraveler(c.get("db"), c.req.param("travelerId"))

    if (!row) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Items
  // ==========================================================================

  // 16. GET /:id/items — List booking items
  .get("/:id/items", async (c) => {
    return c.json({ data: await bookingsService.listItems(c.get("db"), c.req.param("id")) })
  })

  // 17. POST /:id/items — Add booking item
  .post("/:id/items", async (c) => {
    const row = await bookingsService.createItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingItemSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 18. PATCH /:id/items/:itemId — Update booking item
  .patch("/:id/items/:itemId", async (c) => {
    const row = await bookingsService.updateItem(
      c.get("db"),
      c.req.param("itemId"),
      await parseJsonBody(c, updateBookingItemSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ data: row })
  })

  // 19. DELETE /:id/items/:itemId — Delete booking item
  .delete("/:id/items/:itemId", async (c) => {
    const row = await bookingsService.deleteItem(c.get("db"), c.req.param("itemId"))

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // 20. GET /:id/items/:itemId/travelers — List item travelers
  .get("/:id/items/:itemId/travelers", async (c) => {
    return c.json({
      data: await bookingsService.listItemParticipants(c.get("db"), c.req.param("itemId")),
    })
  })

  // 21. POST /:id/items/:itemId/travelers — Link traveler to item
  .post("/:id/items/:itemId/travelers", async (c) => {
    const row = await bookingsService.addItemParticipant(
      c.get("db"),
      c.req.param("itemId"),
      await parseJsonBody(c, insertBookingItemTravelerSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 22. DELETE /:id/items/:itemId/travelers/:linkId — Unlink traveler from item
  .delete("/:id/items/:itemId/travelers/:linkId", async (c) => {
    const row = await bookingsService.removeItemParticipant(c.get("db"), c.req.param("linkId"))

    if (!row) {
      return c.json({ error: "Booking item traveler link not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Supplier Statuses
  // ==========================================================================

  .get("/:id/supplier-statuses", async (c) => {
    return c.json({
      data: await bookingsService.listSupplierStatuses(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/supplier-statuses", async (c) => {
    const row = await bookingsService.createSupplierStatus(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertSupplierStatusSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/:id/supplier-statuses/:statusId", async (c) => {
    const row = await bookingsService.updateSupplierStatus(
      c.get("db"),
      c.req.param("id"),
      c.req.param("statusId"),
      await parseJsonBody(c, updateSupplierStatusSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Supplier status not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ==========================================================================
  // Fulfillment
  // ==========================================================================

  .get("/:id/fulfillments", async (c) => {
    return c.json({ data: await bookingsService.listFulfillments(c.get("db"), c.req.param("id")) })
  })

  .post("/:id/fulfillments", async (c) => {
    const row = await bookingsService.issueFulfillment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingFulfillmentSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking, item, or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/:id/fulfillments/:fulfillmentId", async (c) => {
    const row = await bookingsService.updateFulfillment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("fulfillmentId"),
      await parseJsonBody(c, updateBookingFulfillmentSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Fulfillment, item, or traveler not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ==========================================================================
  // Redemption
  // ==========================================================================

  .get("/:id/redemptions", async (c) => {
    return c.json({
      data: await bookingsService.listRedemptionEvents(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/redemptions", async (c) => {
    const row = await bookingsService.recordRedemption(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, recordBookingRedemptionSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking, item, or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Activity Log
  // ==========================================================================

  // 26. GET /:id/activity — List activity log
  .get("/:id/activity", async (c) => {
    return c.json({ data: await bookingsService.listActivity(c.get("db"), c.req.param("id")) })
  })

  // 26a. GET /:id/group — Shared-room group membership for this booking (or null)
  .get("/:id/group", async (c) => {
    const result = await bookingGroupsService.getBookingGroupForBooking(
      c.get("db"),
      c.req.param("id"),
    )
    return c.json({ data: result ?? null })
  })

  // ==========================================================================
  // Notes
  // ==========================================================================

  // 27. GET /:id/notes — List notes
  .get("/:id/notes", async (c) => {
    return c.json({ data: await bookingsService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // 28. POST /:id/notes — Add note
  .post("/:id/notes", async (c) => {
    const userId = requireUserId(c)
    const row = await bookingsService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertBookingNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 28b. DELETE /:id/notes/:noteId — Delete note
  .delete("/:id/notes/:noteId", async (c) => {
    const row = await bookingsService.deleteNote(c.get("db"), c.req.param("noteId"))

    if (!row) {
      return c.json({ error: "Note not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Documents
  // ==========================================================================

  // 29. GET /:id/documents — List documents for booking
  .get("/:id/documents", async (c) => {
    return c.json({ data: await bookingsService.listDocuments(c.get("db"), c.req.param("id")) })
  })

  // 30. POST /:id/documents — Add document to booking
  .post("/:id/documents", async (c) => {
    const row = await bookingsService.createDocument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingDocumentSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 31. DELETE /:id/documents/:documentId — Delete document
  .delete("/:id/documents/:documentId", async (c) => {
    const row = await bookingsService.deleteDocument(c.get("db"), c.req.param("documentId"))

    if (!row) {
      return c.json({ error: "Document not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Booking Groups (shared-room / split-booking model)
  // ==========================================================================
  .route("/groups", bookingGroupRoutes)

export type BookingRoutes = typeof bookingRoutes
export type PublicBookingRoutes = typeof publicBookingRoutes
