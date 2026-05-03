/**
 * Channel-push EventBus subscribers.
 *
 * The `booking.confirmed` subscriber writes durable intent rows to
 * `channel_booking_links` and returns immediately — per §4.5 the
 * subscriber MUST NOT do HTTP work because the EventBus is in-process
 * and sequential. The intent rows are drained by `processBookingPush`
 * (called inline in v1, or by the durable workflow in production).
 *
 * Per docs/architecture/channel-push-architecture.md §4.1.
 */

import type { EventEnvelope, Subscriber } from "@voyantjs/core"

import {
  processBookingPush,
  resolveBookingPushTargets,
  upsertPendingBookingLinks,
} from "./booking-push.js"
import {
  type ChannelPushDeps,
  defaultLogger,
  getChannelPushDeps,
  getChannelPushDepsOrThrow,
} from "./types.js"

interface BookingConfirmedPayload {
  bookingId: string
  bookingNumber?: string
  actorId?: string | null
}

function coerceBookingConfirmed(envelope: EventEnvelope<unknown>): BookingConfirmedPayload | null {
  const data = envelope.data
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.bookingId !== "string") return null
  return maybe as unknown as BookingConfirmedPayload
}

export interface ChannelPushSubscribersOptions {
  /**
   * When `true` (default), the subscriber drains intent rows inline
   * after writing them. Useful for dev / single-process templates.
   * Production deployments with the workflow runtime wired set this
   * to `false` and rely on `channel.booking.push` to drain.
   */
  drainInline?: boolean
  /**
   * Optional explicit deps. Falls back to `getChannelPushDeps()`.
   * Tests pass deps directly so they don't have to wire the global.
   */
  deps?: ChannelPushDeps
}

/**
 * Construct the channel-push subscriber bundle. Templates pass these to
 * `registerPlugins({ subscribers })` or attach them to an EventBus
 * directly via `eventBus.subscribe`.
 */
export function createChannelPushSubscribers(
  options: ChannelPushSubscribersOptions = {},
): Subscriber[] {
  const drainInline = options.drainInline ?? true

  const handler = async (envelope: EventEnvelope<unknown>): Promise<void> => {
    const payload = coerceBookingConfirmed(envelope)
    if (!payload) return

    const deps = options.deps ?? getChannelPushDeps()
    if (!deps) {
      // Templates haven't wired channel-push — silent no-op so the rest
      // of the booking flow isn't impacted by missing wiring.
      return
    }
    const logger = deps.logger ?? defaultLogger

    try {
      const targets = await resolveBookingPushTargets(deps.db, payload.bookingId)
      if (targets.length === 0) return

      await upsertPendingBookingLinks(deps.db, payload.bookingId, targets)

      if (drainInline) {
        // Inline drain — simple deployments without the workflow runtime
        // wired (dev templates, demo mode). Production uses the workflow
        // and skips this branch.
        await processBookingPush({ bookingId: payload.bookingId }, deps)
      }
    } catch (err) {
      logger.error("[channel-push] booking.confirmed subscriber failed", {
        bookingId: payload.bookingId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return [
    {
      event: "booking.confirmed",
      handler,
    },
  ]
}

/**
 * Trigger the booking-push pipeline for an arbitrary booking id —
 * useful for the operator dashboard's "retry sync" button and for the
 * reconciler (Phase G).
 */
export async function triggerBookingPushForBooking(bookingId: string): Promise<void> {
  const deps = getChannelPushDepsOrThrow()
  const targets = await resolveBookingPushTargets(deps.db, bookingId)
  if (targets.length === 0) return
  await upsertPendingBookingLinks(deps.db, bookingId, targets)
  await processBookingPush({ bookingId }, deps)
}
