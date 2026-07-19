import type { EventBus, EventHandler } from "@voyant-travel/core"
import type { PublicBookingOwner } from "@voyant-travel/bookings"
import { getWriteIntent, settleWriteIntent } from "@voyant-travel/db/write-intents"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  createStorefrontService,
  type StorefrontRequestContext,
  type StorefrontServiceOptions,
} from "./service.js"
import { storefrontBookingSessionBootstrapInputSchema } from "./validation.js"

/**
 * Async booking-session bootstrap over the queued write pipeline (RFC
 * voyant#1687 Phase 3.2).
 *
 * Flow: the public route validates the body, stores a `write_intents`
 * row, durably emits {@link BOOKING_BOOTSTRAP_INTENT_EVENT} (outbox),
 * and answers 202 + a status URL. This handler — registered on the
 * app's event bus by the deployment — executes the SAME bootstrap
 * service the sync route uses and settles the intent. The outbox owns
 * delivery: immediate attempt at emit time, retries with backoff on
 * infra failure, dead-letter backstopped by the stale-intent sweep.
 *
 * Outcome semantics: business conclusions (capacity conflict, stale
 * quote, departure gone) settle the intent as `failed` WITH the
 * conflict detail and are never retried — retrying "sold out" doesn't
 * un-sell it. Unexpected errors re-throw so the outbox redelivers
 * (`settleWriteIntent` only transitions pending rows, so at-least-once
 * redelivery after a success is a no-op).
 */

export const BOOKING_BOOTSTRAP_INTENT_KIND = "storefront.booking.bootstrap"
export const BOOKING_BOOTSTRAP_INTENT_EVENT = "storefront.booking.bootstrap.requested"

export interface BookingBootstrapIntentPayload {
  input: unknown
  userId?: string
  /** Canonical owner accepted and snapshotted synchronously at enqueue time. */
  owner: PublicBookingOwner | null
}

/** Final business outcomes → the HTTP status the sync route would return. */
const FINAL_CONFLICT_STATUS: Record<string, number> = {
  departure_not_found: 404,
  slot_not_found: 404,
  invalid_slot: 400,
  insufficient_capacity: 409,
  slot_unavailable: 409,
  pricing_unavailable: 409,
  stale_quote: 409,
}

export interface BookingBootstrapIntentDeps {
  /** Per-invocation db (the operator passes its capability resolver). */
  resolveDb: () => PostgresJsDatabase
  /**
   * The APP bus (e.g. `app.eventBus`) so booking events emitted by the
   * reserve flow (booking.created, availability.slot.changed, …) reach
   * the same subscribers as a sync bootstrap.
   */
  eventBus?: EventBus
  env?: StorefrontRequestContext["env"]
  serviceOptions?: StorefrontServiceOptions
}

export function createBookingBootstrapIntentHandler(
  deps: BookingBootstrapIntentDeps,
): EventHandler {
  const storefrontService = createStorefrontService(deps.serviceOptions)

  return async (envelope) => {
    const intentId = (envelope.data as { intentId?: string } | undefined)?.intentId
    if (!intentId) return

    const db = deps.resolveDb()
    const intent = await getWriteIntent(db, intentId)
    if (!intent || intent.kind !== BOOKING_BOOTSTRAP_INTENT_KIND || intent.status !== "pending") {
      return
    }

    const payload = intent.payload as BookingBootstrapIntentPayload
    const parsed = storefrontBookingSessionBootstrapInputSchema.safeParse(payload.input)
    if (!parsed.success) {
      // Should be unreachable (the route validated before enqueueing) —
      // settle rather than retry a permanently-invalid payload.
      await settleWriteIntent(db, intentId, {
        status: "failed",
        error: `invalid intent payload: ${parsed.error.message.slice(0, 500)}`,
      })
      return
    }

    // Unexpected throws propagate → the outbox retries the delivery.
    const result = await storefrontService.bootstrapBookingSession(
      {
        db,
        eventBus: deps.eventBus,
        env: deps.env,
      } as StorefrontRequestContext & { db: PostgresJsDatabase },
      parsed.data,
      payload.userId,
      payload.owner,
    )

    if (result.status === "ok" && "bootstrap" in result) {
      await settleWriteIntent(db, intentId, {
        status: "succeeded",
        result: { bootstrap: result.bootstrap },
      })
      return
    }

    const httpStatus = FINAL_CONFLICT_STATUS[result.status] ?? 409
    await settleWriteIntent(db, intentId, {
      status: "failed",
      error: result.status,
      result: {
        conflict: result.status,
        httpStatus,
        ...(result.status === "stale_quote" && "repricing" in result
          ? { repricing: result.repricing }
          : {}),
      },
    })
  }
}
