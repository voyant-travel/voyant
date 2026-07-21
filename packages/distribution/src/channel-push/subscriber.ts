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

import { bookings } from "@voyant-travel/bookings/schema"
import type { EventEnvelope, Subscriber } from "@voyant-travel/core"
import { eq } from "drizzle-orm"

import {
  processAvailabilityPushIntents,
  resolveAllotmentTargetsForSlot,
  upsertAvailabilityIntent,
} from "./availability-push.js"
import {
  type ProcessBookingPushResult,
  processBookingPush,
  resolveBookingPushTargets,
  upsertPendingBookingLinks,
} from "./booking-push.js"
import {
  processContentPushIntents,
  resolveContentPushTargets,
  upsertContentIntent,
} from "./content-push.js"
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

interface ProductContentChangedPayload {
  id: string
  axis?: string
}

interface AvailabilitySlotChangedPayload {
  slotId: string
  productId: string
  optionId: string | null
  startsAt: Date | string
  remainingPax: number | null
  unlimited: boolean
  source: string
}

function coerceBookingConfirmed(envelope: EventEnvelope<unknown>): BookingConfirmedPayload | null {
  const data = envelope.data
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.bookingId !== "string") return null
  return {
    bookingId: maybe.bookingId,
    ...(typeof maybe.bookingNumber === "string" ? { bookingNumber: maybe.bookingNumber } : {}),
    ...(typeof maybe.actorId === "string" || maybe.actorId === null
      ? { actorId: maybe.actorId }
      : {}),
  }
}

function coerceSlotChanged(
  envelope: EventEnvelope<unknown>,
): AvailabilitySlotChangedPayload | null {
  const data = envelope.data
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.slotId !== "string" || typeof maybe.productId !== "string") return null
  if (typeof maybe.optionId !== "string" && maybe.optionId !== null) return null
  if (!(maybe.startsAt instanceof Date) && typeof maybe.startsAt !== "string") return null
  if (typeof maybe.remainingPax !== "number" && maybe.remainingPax !== null) return null
  if (typeof maybe.unlimited !== "boolean" || typeof maybe.source !== "string") return null
  return {
    slotId: maybe.slotId,
    productId: maybe.productId,
    optionId: maybe.optionId,
    startsAt: maybe.startsAt,
    remainingPax: maybe.remainingPax,
    unlimited: maybe.unlimited,
    source: maybe.source,
  }
}

function coerceContentChanged(
  envelope: EventEnvelope<unknown>,
): ProductContentChangedPayload | null {
  const data = envelope.data
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.id !== "string") return null
  return {
    id: maybe.id,
    ...(typeof maybe.axis === "string" ? { axis: maybe.axis } : {}),
  }
}

export interface ChannelPushSubscribersOptions {
  /**
   * When `true` (default), the subscriber drains intent rows inline
   * after writing them. Useful for dev / single-process templates.
   * Production deployments with the package job host wired set this
   * to `false` and rely on `channel.booking.push` to drain.
   */
  drainInline?: boolean
  /**
   * Optional explicit deps. Falls back to `getChannelPushDeps()`.
   * Tests pass deps directly so they don't have to wire the global.
   */
  deps?: ChannelPushDeps
  /** Resolve app-owned dependencies lazily after runtime bootstrap completes. */
  resolveDeps?: () => ChannelPushDeps | undefined
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

    const deps = options.deps ?? options.resolveDeps?.() ?? getChannelPushDeps()
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
        // Inline drain — simple deployments without the package job host
        // wired (dev templates, demo mode). Production uses the selected job
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

  const slotHandler = async (envelope: EventEnvelope<unknown>): Promise<void> => {
    const payload = coerceSlotChanged(envelope)
    if (!payload) return

    const deps = options.deps ?? options.resolveDeps?.() ?? getChannelPushDeps()
    if (!deps) return
    const logger = deps.logger ?? defaultLogger

    try {
      const targets = await resolveAllotmentTargetsForSlot(deps.db, {
        slotId: payload.slotId,
        productId: payload.productId,
        optionId: payload.optionId,
      })
      if (targets.length === 0) return

      const startsAt =
        payload.startsAt instanceof Date ? payload.startsAt : new Date(payload.startsAt)

      // One intent per (channel, slot) pair — supersession collapses
      // concurrent events.
      for (const target of targets) {
        await upsertAvailabilityIntent(deps.db, {
          channelId: target.channelId,
          sourceConnectionId: target.sourceConnectionId,
          slotId: payload.slotId,
          productId: payload.productId,
          optionId: payload.optionId,
          startsAt,
        })
      }

      if (drainInline) {
        // Drain only this channel's intents to keep latency bounded.
        // (v1 dev behavior; production runs the scheduled job.)
        for (const target of targets) {
          await processAvailabilityPushIntents({ channelId: target.channelId, limit: 50 }, deps)
        }
      }
    } catch (err) {
      logger.error("[channel-push] availability.slot.changed subscriber failed", {
        slotId: payload.slotId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const contentHandler = async (envelope: EventEnvelope<unknown>): Promise<void> => {
    const payload = coerceContentChanged(envelope)
    if (!payload) return

    const deps = options.deps ?? options.resolveDeps?.() ?? getChannelPushDeps()
    if (!deps) return
    const logger = deps.logger ?? defaultLogger

    try {
      const targets = await resolveContentPushTargets(deps.db, payload.id)
      if (targets.length === 0) return

      for (const target of targets) {
        await upsertContentIntent(deps.db, {
          channelId: target.channelId,
          sourceConnectionId: target.sourceConnectionId,
          productId: payload.id,
        })
      }

      if (drainInline) {
        for (const target of targets) {
          await processContentPushIntents({ channelId: target.channelId, limit: 50 }, deps)
        }
      }
    } catch (err) {
      logger.error("[channel-push] product.content.changed subscriber failed", {
        productId: payload.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return [
    { event: "booking.confirmed", handler },
    { event: "availability.slot.changed", handler: slotHandler },
    { event: "product.content.changed", handler: contentHandler },
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

export interface TriggerBookingPushResult extends Omit<ProcessBookingPushResult, "reason"> {
  targetCount: number
  insertedLinks: number
  reason?: ProcessBookingPushResult["reason"] | "no_targets"
}

/**
 * Trigger booking push and return operator-facing diagnostics for retry UI.
 */
export async function triggerBookingPushForBookingWithResult(
  bookingId: string,
): Promise<TriggerBookingPushResult> {
  const deps = getChannelPushDepsOrThrow()
  const targets = await resolveBookingPushTargets(deps.db, bookingId)
  let bookingExists: boolean | undefined

  if (targets.length === 0) {
    const [booking] = await deps.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    bookingExists = Boolean(booking)
  }

  const insertedLinks =
    targets.length > 0 ? await upsertPendingBookingLinks(deps.db, bookingId, targets) : 0
  const result = await processBookingPush({ bookingId }, deps)

  return {
    ...result,
    targetCount: targets.length,
    insertedLinks,
    reason:
      bookingExists === false
        ? "booking_missing"
        : targets.length === 0 && result.attempted === 0 && result.outcomes.length === 0
          ? "no_targets"
          : result.reason,
  }
}
