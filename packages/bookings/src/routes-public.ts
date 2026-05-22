import { idempotencyKey, parseJsonBody, parseQuery, UnauthorizedApiError } from "@voyantjs/hono"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"

import {
  type CheckoutCapabilityAction,
  checkoutCapabilityActions,
  checkoutCapabilityCookie,
  issueCheckoutCapability,
  requireCheckoutCapability,
} from "./checkout-capability.js"
import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntime,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
import { type Env, getRuntimeEnv, notFound } from "./routes-shared.js"
import { type PublicBookingsServiceResolvers, publicBookingsService } from "./service-public.js"
import {
  publicBookingOverviewLookupQuerySchema,
  publicBookingSessionMutationSchema,
  publicCreateBookingSessionSchema,
  publicRepriceBookingSessionSchema,
  publicUpdateBookingSessionSchema,
  publicUpsertBookingSessionStateSchema,
} from "./validation-public.js"

function hasSessionResult(
  result: { status: string } | { status: "ok"; session: unknown },
): result is { status: "ok"; session: unknown } {
  return "session" in result
}

function sessionConflictError(status: string) {
  switch (status) {
    case "insufficient_capacity":
      return "Insufficient slot capacity"
    case "slot_unavailable":
      return "Availability slot is not bookable"
    case "invalid_transition":
      return "Booking session cannot move to the requested state"
    case "hold_expired":
      return "Booking session hold has expired"
    case "participant_not_found":
      return "Booking session traveler not found"
    case "pricing_unavailable":
      return "Pricing is not available for the selected booking session items"
    case "quantity_change_requires_reallocation":
      return "Changing quantity for held items requires a fresh reservation"
    default:
      return "Unable to process booking session"
  }
}

function attachCheckoutCapability<T extends { sessionId: string }>(
  session: T,
  issued: Awaited<ReturnType<typeof issueCheckoutCapability>>,
) {
  return {
    ...session,
    checkoutCapability: {
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      actions: [...checkoutCapabilityActions],
    },
  }
}

async function requireSessionCapability(c: Context, action: CheckoutCapabilityAction) {
  const sessionId = c.req.param("sessionId")
  if (!sessionId) {
    throw new UnauthorizedApiError("Missing checkout session id")
  }

  await requireCheckoutCapability(c, sessionId, action, getRuntimeEnv(c))
}

function sessionCapability(action: CheckoutCapabilityAction): MiddlewareHandler<Env> {
  return async (c, next) => {
    await requireSessionCapability(c, action)
    await next()
  }
}

function getRouteRuntime(c: Context): BookingRouteRuntime {
  const container = (c.var as { container?: { resolve: (key: string) => unknown } }).container
  try {
    return (
      (container?.resolve(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) as
        | BookingRouteRuntime
        | undefined) ?? buildBookingRouteRuntime(c.env as Record<string, string | undefined>)
    )
  } catch {
    return buildBookingRouteRuntime(c.env as Record<string, string | undefined>)
  }
}

function publicResolvers(c: Context): PublicBookingsServiceResolvers {
  const runtime = getRouteRuntime(c)
  return {
    resolveBillingPerson: runtime.resolveBillingPerson,
    resolveTravelerPerson: runtime.resolveTravelerPerson,
  }
}

export const publicBookingRoutes = new Hono<Env>()
  .post("/sessions", idempotencyKey({ scope: "POST /v1/public/bookings/sessions" }), async (c) => {
    const result = await publicBookingsService.createSession(
      c.get("db"),
      await parseJsonBody(c, publicCreateBookingSessionSchema),
      c.get("userId"),
      publicResolvers(c),
    )

    if (result.status === "slot_not_found") {
      return notFound(c, "Availability slot not found")
    }

    if (!hasSessionResult(result)) {
      return c.json({ error: sessionConflictError(result.status) }, 409)
    }

    const capability = await issueCheckoutCapability(
      (result.session as { sessionId: string }).sessionId,
      getRuntimeEnv(c),
    )
    c.header("Set-Cookie", checkoutCapabilityCookie(capability.token, capability.expiresAt), {
      append: true,
    })

    return c.json(
      { data: attachCheckoutCapability(result.session as { sessionId: string }, capability) },
      201,
    )
  })
  .get("/sessions/:sessionId", async (c) => {
    await requireSessionCapability(c, "session:read")

    const session = await publicBookingsService.getSessionById(
      c.get("db"),
      c.req.param("sessionId"),
    )

    return session ? c.json({ data: session }) : notFound(c, "Booking session not found")
  })
  .patch(
    "/sessions/:sessionId",
    sessionCapability("session:update"),
    idempotencyKey(),
    async (c) => {
      const result = await publicBookingsService.updateSession(
        c.get("db"),
        c.req.param("sessionId"),
        await parseJsonBody(c, publicUpdateBookingSessionSchema),
        c.get("userId"),
        publicResolvers(c),
      )

      if (result.status === "not_found") {
        return notFound(c, "Booking session not found")
      }

      if (!hasSessionResult(result)) {
        return c.json({ error: sessionConflictError(result.status) }, 409)
      }

      return c.json({ data: result.session })
    },
  )
  .get("/sessions/:sessionId/state", async (c) => {
    await requireSessionCapability(c, "session:read")

    const state = await publicBookingsService.getSessionState(c.get("db"), c.req.param("sessionId"))

    return state ? c.json({ data: state }) : notFound(c, "Booking session not found")
  })
  .put(
    "/sessions/:sessionId/state",
    sessionCapability("session:update"),
    idempotencyKey(),
    async (c) => {
      const result = await publicBookingsService.updateSessionState(
        c.get("db"),
        c.req.param("sessionId"),
        await parseJsonBody(c, publicUpsertBookingSessionStateSchema),
        publicResolvers(c),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return notFound(c, "Booking session not found")
      }

      return c.json({ data: result.state })
    },
  )
  .post(
    "/sessions/:sessionId/reprice",
    sessionCapability("session:reprice"),
    idempotencyKey(),
    async (c) => {
      const result = await publicBookingsService.repriceSession(
        c.get("db"),
        c.req.param("sessionId"),
        await parseJsonBody(c, publicRepriceBookingSessionSchema),
      )

      if (result.status === "not_found") {
        return notFound(c, "Booking session not found")
      }

      if (result.status === "invalid_selection") {
        return c.json({ error: "Booking session contains an invalid item selection" }, 400)
      }

      if (result.status !== "ok") {
        return c.json({ error: sessionConflictError(result.status) }, 409)
      }

      return c.json({
        data: {
          pricing: result.pricing,
          session: result.session,
        },
      })
    },
  )
  .post(
    "/sessions/:sessionId/confirm",
    sessionCapability("session:finalize"),
    idempotencyKey(),
    async (c) => {
      const result = await publicBookingsService.confirmSession(
        c.get("db"),
        c.req.param("sessionId"),
        await parseJsonBody(c, publicBookingSessionMutationSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return notFound(c, "Booking session not found")
      }

      if (!hasSessionResult(result)) {
        return c.json({ error: sessionConflictError(result.status) }, 409)
      }

      return c.json({ data: result.session })
    },
  )
  .post(
    "/sessions/:sessionId/expire",
    sessionCapability("session:finalize"),
    idempotencyKey(),
    async (c) => {
      const result = await publicBookingsService.expireSession(
        c.get("db"),
        c.req.param("sessionId"),
        await parseJsonBody(c, publicBookingSessionMutationSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return notFound(c, "Booking session not found")
      }

      if (!hasSessionResult(result)) {
        return c.json({ error: sessionConflictError(result.status) }, 409)
      }

      return c.json({ data: result.session })
    },
  )
  .get("/overview", async (c) => {
    const overview = await publicBookingsService.getOverview(
      c.get("db"),
      await parseQuery(c, publicBookingOverviewLookupQuerySchema),
    )

    return overview ? c.json({ data: overview }) : notFound(c, "Booking overview not found")
  })

export type PublicBookingRoutes = typeof publicBookingRoutes
