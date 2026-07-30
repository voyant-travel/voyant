/**
 * `POST /v1/public/bookings` — public self-service booking creation.
 *
 * The customer-facing adapter to the same durable command the staff Tool
 * drives. It is deliberately thin: it proves who is asking, asks the source
 * provider to verify and derive, allocates the booking number, and hands the
 * whole thing to Finance's self-service entrypoint.
 *
 * A caller supplies three identifiers and nothing else. Booking numbers,
 * relationship ids, prices, tax lines, and status are all derived server-side —
 * a public caller can write the draft, so anything read from it is untrusted
 * input, not intent.
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  checkoutCapabilityCookie,
  issueCheckoutCapability,
} from "@voyant-travel/bookings/checkout-capability"
import { idempotencyKey, openApiValidationHook } from "@voyant-travel/hono"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { executeFinanceSelfServiceBookingCreateCommand } from "./booking-create-command.js"
import {
  FINANCE_BOOKING_CREATE_SELF_SERVICE_ACTION,
  FINANCE_BOOKING_CREATE_SELF_SERVICE_ROUTE,
} from "./booking-create-policy.js"
import { allocateBookingNumber } from "./booking-number.js"
import { getFinanceRouteRuntime } from "./routes-runtime.js"
import type { Env } from "./routes-shared.js"
import type {
  SelfServiceBookingSourceRejection,
  SelfServiceBookingSourceRuntime,
} from "./self-service-booking-source.js"

/** Spends the verified challenge inside the create transaction. */
export interface SelfServiceGuestVerification {
  consume(
    tx: PostgresJsDatabase,
    input: { challengeId: string; subjectRef: string; consumedRef: string },
  ): Promise<{ status: "consumed"; destination: string } | { status: "rejected" }>
  /** Reads the destination a challenge was verified for, before the command runs. */
  peekVerifiedDestination(
    db: PostgresJsDatabase,
    input: { challengeId: string; subjectRef: string },
  ): Promise<{ channel: "email" | "sms"; destination: string } | null>
}

export interface PublicBookingCreateRouteOptions {
  /**
   * Mints the route admission. Supplied by the deployment, which registered
   * the action on its selected graph — the route never fabricates one.
   */
  resolveRouteActionAdmission?(
    c: Context,
  ): ((actor: string, key: string) => ToolHandlerActionPolicyContext) | undefined
  resolveBookingSource?(c: Context): SelfServiceBookingSourceRuntime | undefined
  resolveGuestVerification?(c: Context): SelfServiceGuestVerification | undefined
  /** The authenticated customer's CRM person id, when the caller has an account. */
  resolveAuthenticatedPersonId?(c: Context): string | undefined
}

const errorResponseSchema = z.object({ error: z.string() })

const createBookingRequestSchema = z.object({
  draftId: z.string().trim().min(1),
  quoteId: z.string().trim().min(1),
  /** Omitted for an authenticated customer. */
  verificationChallengeId: z.string().trim().min(1).optional(),
})

const createBookingResponseSchema = z.object({
  data: z.object({
    bookingId: z.string(),
    bookingNumber: z.string(),
    status: z.string(),
    checkoutCapability: z.object({
      token: z.string(),
      expiresAt: z.string(),
      actions: z.array(z.string()),
    }),
  }),
})

/** Rejections map to a status the caller can act on without string matching. */
const REJECTION_STATUS: Record<SelfServiceBookingSourceRejection, 404 | 409 | 422> = {
  draft_not_found: 404,
  quote_not_found: 404,
  draft_consumed: 409,
  quote_consumed: 409,
  quote_expired: 409,
  hold_expired: 409,
  price_changed: 409,
  entity_mismatch: 422,
  not_public: 422,
  contact_mismatch: 422,
  incomplete_draft: 422,
  unsupported_vertical: 422,
}

const createBookingRoute = createRoute({
  method: "post",
  path: "/bookings",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createBookingRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Booking created, with the scoped checkout capability",
      content: { "application/json": { schema: createBookingResponseSchema } },
    },
    400: {
      description: "invalid_request: body failed validation or Idempotency-Key is missing",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    401: {
      description: "Neither an authenticated customer nor a verified challenge",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Draft or quote not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Draft, quote, or hold is no longer spendable",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "Draft cannot produce a booking for this caller",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "This deployment has no self-service booking source provider",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createPublicBookingCreateRoutes(options: PublicBookingCreateRouteOptions = {}) {
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

  // A create without a stable key cannot be retried safely, so it is required
  // rather than optional. This is the HTTP-level replay guard; the durable
  // command keeps its own claim underneath.
  routes.use("/bookings", idempotencyKey({ required: true }))

  return routes.openapi(createBookingRoute, async (c) => {
    const body = c.req.valid("json")
    const db = c.get("db") as PostgresJsDatabase

    const source = options.resolveBookingSource?.(c)
    const admit = options.resolveRouteActionAdmission?.(c)
    if (!source || !admit) {
      return c.json({ error: "self_service_booking_unavailable" }, 501)
    }

    // Either an account or a verified challenge — never neither.
    const personId = options.resolveAuthenticatedPersonId?.(c)
    const verification = options.resolveGuestVerification?.(c)
    let verified: { channel: "email" | "sms"; destination: string } | null = null
    if (!personId) {
      if (!body.verificationChallengeId || !verification) {
        return c.json({ error: "verification_required" }, 401)
      }
      verified = await verification.peekVerifiedDestination(db, {
        challengeId: body.verificationChallengeId,
        subjectRef: body.draftId,
      })
      if (!verified) return c.json({ error: "verification_required" }, 401)
    }

    const resolved = await source.resolveBookingSource({
      db,
      draftId: body.draftId,
      quoteId: body.quoteId,
      caller: {
        ...(personId ? { personId } : {}),
        ...(verified?.channel === "email" ? { verifiedEmail: verified.destination } : {}),
        ...(verified?.channel === "sms" ? { verifiedPhone: verified.destination } : {}),
      },
    })
    if (resolved.status !== "ok") {
      return c.json({ error: resolved.reason }, REJECTION_STATUS[resolved.reason])
    }

    // Allocated here, never accepted from the caller.
    const bookingNumber = await allocateBookingNumber(db)
    const requestKey = c.req.header("Idempotency-Key") ?? ""
    const admitted = admit("customer", requestKey)

    const challengeId = body.verificationChallengeId
    const result = await executeFinanceSelfServiceBookingCreateCommand({
      db,
      context: {
        actor: "customer",
        callerType: "session",
        principalSubtype: "verified_guest",
        ...(challengeId ? { sessionId: challengeId } : {}),
      },
      // Challenge-derived, non-user principal: the synthetic identity stays
      // out of `userId` so it can never reach `createdByUserId`.
      fallbackPrincipalId: challengeId
        ? `storefront-verification:${challengeId}`
        : `customer:${personId}`,
      commandInput: { ...resolved.command, bookingNumber } as never,
      admitted,
      runtime: getFinanceRouteRuntime(c),
      async consumeSources(tx, bookingId) {
        await source.consumeBookingSource(tx, {
          draftId: body.draftId,
          quoteId: body.quoteId,
          bookingId,
        })
        if (challengeId && verification) {
          const spent = await verification.consume(tx, {
            challengeId,
            subjectRef: body.draftId,
            consumedRef: bookingId,
          })
          // Rolls the whole create back rather than letting one challenge
          // authorize a second booking.
          if (spent.status !== "consumed") {
            throw new Error("verification challenge could not be consumed")
          }
        }
      },
    })

    const capability = await issueCheckoutCapability(result.value.bookingId, c.env)
    c.header("Set-Cookie", checkoutCapabilityCookie(capability.token, capability.expiresAt))

    return c.json(
      {
        data: {
          bookingId: result.value.bookingId,
          bookingNumber,
          status: "on_hold",
          checkoutCapability: {
            token: capability.token,
            expiresAt: capability.expiresAt.toISOString(),
            actions: [...capability.payload.actions],
          },
        },
      },
      201,
    )
  })
}

export const FINANCE_SELF_SERVICE_CREATE_IDS = {
  action: FINANCE_BOOKING_CREATE_SELF_SERVICE_ACTION,
  route: FINANCE_BOOKING_CREATE_SELF_SERVICE_ROUTE,
} as const
