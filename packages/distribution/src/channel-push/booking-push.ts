/**
 * Booking-push pipeline.
 *
 * Triggered by `booking.confirmed`. The subscriber writes pending
 * `channel_booking_links` rows and returns immediately (per the EventBus
 * fire-and-forget contract). The durable processor (`processBookingPush`)
 * drains those rows, calls `adapter.pushBooking()` per link, and marks
 * each row `ok` or `failed`.
 *
 * Per docs/architecture/channel-push-architecture.md §4 + §12.1.
 */

import { bookingItems, bookings } from "@voyant-travel/bookings/schema"
import {
  AdapterRateLimitedError,
  type PushBookingRequest,
  type SourceAdapter,
  type SourceAdapterContext,
} from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import {
  channelBookingLinks,
  channelProductMappings,
  channels,
} from "@voyant-travel/distribution/schema"
import { and, eq, inArray } from "drizzle-orm"

import { acquireToken, channelScopeKey, drainBucket } from "../rate-limit.js"
import { prepareOutboundEnvelope } from "../webhook-deliveries.js"

import {
  compensateSucceededLink,
  markLinkFailed,
  markLinkOk,
  rateLimitConfigForChannel,
  readMappingForLink,
  resolveCompensationPolicy,
  serializeBookingForPush,
} from "./booking-push-helpers.js"

import { type ChannelPushDeps, defaultLogger, getChannelPushDepsOrThrow } from "./types.js"

/** Stable string identifier for the booking-push workflow. */
export const CHANNEL_BOOKING_PUSH_WORKFLOW_ID = "channel.booking.push" as const

export interface ProcessBookingPushInput {
  bookingId: string
}

export interface ProcessBookingPushResult {
  bookingId: string
  attempted: number
  succeeded: number
  failed: number
  /**
   * Number of succeeded links that were compensated (rolled back via
   * `adapter.cancel`) because the contract's `compensation` policy is
   * `"strict-atomic"` and at least one sibling failed. Always 0 under
   * the default `"eventually-consistent"` policy.
   */
  compensated: number
  /** Per-link outcomes for diagnostics. */
  outcomes: Array<{
    channelId: string
    bookingItemId: string | null
    status: "ok" | "failed" | "skipped" | "compensated"
    upstreamRef?: string
    error?: string
  }>
  reason?: "no_pending_links" | "booking_missing"
}

/**
 * Compensation modes per `channel_contracts.policy.compensation`.
 *
 * - `eventually-consistent` (default): partial successes stay; ops gets
 *   alerted via `webhook_deliveries` and retries via the reconciler.
 *   Usually correct for travel inventory — succeeded channels know
 *   about the booking and will honor it; the failed ones converge.
 * - `strict-atomic`: on any per-link failure, the engine calls
 *   `adapter.cancel` for succeeded siblings and marks them
 *   `push_status = 'compensated'`. Use only when ALL channels MUST
 *   agree on the booking's existence (rare).
 *
 * Per docs/architecture/channel-push-architecture.md §4.2 + §9.
 */
export type CompensationPolicy = "strict-atomic" | "eventually-consistent"

/**
 * Build the stable idempotency key the upstream uses to dedupe pushes
 * across retries. Per §3.
 */
export function bookingPushIdempotencyKey(
  bookingId: string,
  bookingItemId: string | null,
  channelId: string,
): string {
  return `book:${bookingId}:${bookingItemId ?? "*"}:${channelId}`
}

/**
 * Resolve the channels that want a push for this booking. One row per
 * (booking_item, channel) pair where the mapping has push_bookings =
 * true and the channel is active. Booking-level pushes (no item id) are
 * supported via a synthetic item id of null.
 *
 * Per §7.4 — booking push uses `channel_product_mappings` (not
 * `channel_inventory_allotments`) so channels mapped to a product
 * without a slot allotment still receive the push.
 */
export async function resolveBookingPushTargets(
  db: AnyDrizzleDb,
  bookingId: string,
): Promise<
  Array<{
    bookingItemId: string | null
    productId: string
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>
> {
  const items = (await db
    .select({
      id: bookingItems.id,
      productId: bookingItems.productId,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))) as Array<{
    id: string
    productId: string | null
  }>

  if (items.length === 0) return []

  const productIds = Array.from(new Set(items.filter((i) => i.productId).map((i) => i.productId!)))
  if (productIds.length === 0) return []

  const rows = (await db
    .select({
      mapping: channelProductMappings,
      channel: channels,
    })
    .from(channelProductMappings)
    .innerJoin(channels, eq(channelProductMappings.channelId, channels.id))
    .where(
      and(
        eq(channelProductMappings.active, true),
        eq(channelProductMappings.pushBookings, true),
        inArray(channelProductMappings.productId, productIds),
        eq(channels.status, "active"),
      ),
    )) as Array<{
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  if (rows.length === 0) return []

  const out: Array<{
    bookingItemId: string | null
    productId: string
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }> = []
  for (const item of items) {
    if (!item.productId) continue
    for (const row of rows) {
      if (row.mapping.productId !== item.productId) continue
      out.push({
        bookingItemId: item.id,
        productId: item.productId,
        mapping: row.mapping,
        channel: row.channel,
      })
    }
  }
  return out
}

/**
 * Insert pending `channel_booking_links` rows for each push target.
 * `INSERT ... ON CONFLICT DO NOTHING` against the
 * `(channel_id, booking_id, COALESCE(booking_item_id, ''))` unique
 * index — durable handoff with no doubled-push risk per §7.1.
 *
 * Returns the count of newly-inserted rows. Subscribers don't strictly
 * need this — the processor reads pending rows by query — but tests
 * find it useful.
 */
export async function upsertPendingBookingLinks(
  db: AnyDrizzleDb,
  bookingId: string,
  targets: Array<{
    bookingItemId: string | null
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>,
): Promise<number> {
  if (targets.length === 0) return 0

  const rows = targets.map((target) => ({
    id: newId("channel_booking_links"),
    channelId: target.channel.id,
    bookingId,
    bookingItemId: target.bookingItemId,
    sourceKind: target.mapping.sourceKind ?? null,
    sourceConnectionId: target.mapping.sourceConnectionId ?? null,
    pushStatus: "pending" as const,
    idempotencyKey: bookingPushIdempotencyKey(bookingId, target.bookingItemId, target.channel.id),
  }))

  // Drizzle's onConflictDoNothing without an explicit target falls back
  // to the (channel, booking, item) unique index we created in §7.1.
  const inserted = (await db
    .insert(channelBookingLinks)
    .values(rows)
    .onConflictDoNothing()
    .returning()) as Array<typeof channelBookingLinks.$inferSelect>

  return inserted.length
}

/**
 * Drain pending or retryable failed `channel_booking_links` rows for one booking and call
 * `adapter.pushBooking()` per link. Idempotent: re-running the
 * processor against the same booking is safe — the `idempotency_key`
 * column ensures retries don't double-push upstream.
 *
 * Each adapter call:
 *   1. Acquires a token from the per-channel/connection bucket.
 *   2. Calls the adapter through `prepareOutboundEnvelope` so every
 *      attempt lands in `webhook_deliveries` with redacted headers.
 *   3. Updates the link to `ok` (with upstream_ref, hash) or `failed`
 *      (with last_error, attempts++).
 *
 * Per §4.2 + §12.1.
 */
export async function processBookingPush(
  input: ProcessBookingPushInput,
  deps?: ChannelPushDeps,
): Promise<ProcessBookingPushResult> {
  const { db, registry, logger = defaultLogger } = deps ?? getChannelPushDepsOrThrow()
  const outcomes: ProcessBookingPushResult["outcomes"] = []

  const links = (await db
    .select({
      link: channelBookingLinks,
      channel: channels,
    })
    .from(channelBookingLinks)
    .innerJoin(channels, eq(channelBookingLinks.channelId, channels.id))
    .where(
      and(
        eq(channelBookingLinks.bookingId, input.bookingId),
        inArray(channelBookingLinks.pushStatus, ["pending", "failed"]),
      ),
    )) as Array<{
    link: typeof channelBookingLinks.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  if (links.length === 0) {
    return {
      bookingId: input.bookingId,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      compensated: 0,
      outcomes,
      reason: "no_pending_links",
    }
  }

  const [booking] = (await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1)) as Array<typeof bookings.$inferSelect>

  if (!booking) {
    logger.error?.(`processBookingPush: booking ${input.bookingId} not found`, {})
    for (const { link, channel } of links) {
      await markLinkFailed(db, link.id, link.pushAttempts + 1, "booking_missing")
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "failed",
        error: "booking_missing",
      })
    }
    return {
      bookingId: input.bookingId,
      attempted: links.length,
      succeeded: 0,
      failed: links.length,
      compensated: 0,
      outcomes,
      reason: "booking_missing",
    }
  }

  let succeeded = 0
  let failed = 0
  // Track succeeded links so we can compensate them if a sibling fails
  // and the contract policy demands strict-atomicity. Per §4.2.
  const successList: Array<{
    link: typeof channelBookingLinks.$inferSelect
    channel: typeof channels.$inferSelect
    adapter: SourceAdapter
    adapterCtx: SourceAdapterContext
    upstreamRef: string
  }> = []

  for (const { link, channel } of links) {
    const connectionId = link.sourceConnectionId ?? channel.id
    const adapter = registry.resolveByConnection(connectionId)
    if (!adapter) {
      // Skip — no adapter wired for this connection. Mark the row
      // failed so ops sees it; the reconciler retries when the adapter
      // shows up.
      await markLinkFailed(db, link.id, link.pushAttempts + 1, "no_adapter_registered")
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "failed",
        error: "no_adapter_registered",
      })
      failed += 1
      continue
    }

    if (!adapter.capabilities.supportsBookingPush || !adapter.pushBooking) {
      await markLinkFailed(db, link.id, link.pushAttempts + 1, "adapter_unsupported")
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "failed",
        error: "adapter_unsupported",
      })
      failed += 1
      continue
    }

    // Resolve the per-(channel, item) mapping for the external ids.
    const mapping = await readMappingForLink(db, link, booking)
    if (!mapping) {
      await markLinkFailed(db, link.id, link.pushAttempts + 1, "no_mapping")
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "failed",
        error: "no_mapping",
      })
      failed += 1
      continue
    }

    // Rate limit before dispatching.
    const rlConfig = rateLimitConfigForChannel(channel)
    if (rlConfig) {
      const acq = await acquireToken(
        db,
        channelScopeKey(channel.id, connectionId),
        rlConfig,
        "booking",
      )
      if (!acq.acquired) {
        // Bookings are supposed to pre-empt other flows; if we can't
        // acquire, the bucket is over-tight or the channel just got
        // 429'd. Mark the link failed and move on — reconciler retries.
        await markLinkFailed(db, link.id, link.pushAttempts + 1, "rate_limited")
        outcomes.push({
          channelId: channel.id,
          bookingItemId: link.bookingItemId ?? null,
          status: "failed",
          error: "rate_limited",
        })
        failed += 1
        continue
      }
    }

    const request: PushBookingRequest = {
      idempotencyKey:
        link.idempotencyKey ??
        bookingPushIdempotencyKey(input.bookingId, link.bookingItemId ?? null, channel.id),
      bookingId: input.bookingId,
      bookingItemId: link.bookingItemId ?? undefined,
      externalProductId: mapping.externalProductId ?? "",
      externalRateId: mapping.externalRateId ?? undefined,
      externalCategoryId: mapping.externalCategoryId ?? undefined,
      channelId: channel.id,
      contractPolicy: undefined,
      payload: serializeBookingForPush(booking, link.bookingItemId ?? null),
    }

    const adapterCtx: SourceAdapterContext = {
      connection_id: connectionId,
    }

    // Every attempt writes a webhook_deliveries row through the
    // redactor — direct INSERTs are forbidden per §11.3.
    const envelope = await prepareOutboundEnvelope(db, {
      sourceModule: "distribution",
      sourceEvent: "channel.booking.push",
      sourceEntityModule: "bookings",
      sourceEntityId: input.bookingId,
      targetUrl: `adapter:${adapter.kind}`,
      targetKind: `channel:${adapter.kind}`,
      targetRef: channel.id,
      requestMethod: "POST",
      requestBody: request,
      attemptNumber: link.pushAttempts + 1,
      idempotencyKey: request.idempotencyKey,
    })

    try {
      const result = await adapter.pushBooking(adapterCtx, request)
      await envelope.complete({
        responseStatus: 200,
        responseBody: result,
      })
      await markLinkOk(
        db,
        link.id,
        link.pushAttempts + 1,
        result.upstreamRef,
        result.externalReference ?? null,
        result.externalStatus ?? null,
      )
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "ok",
        upstreamRef: result.upstreamRef,
      })
      succeeded += 1
      successList.push({ link, channel, adapter, adapterCtx, upstreamRef: result.upstreamRef })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // 429 from upstream — drain the bucket for the cooldown so
      // concurrent dispatchers also see "no tokens" until the channel
      // is ready, and stamp the delivery with the rate-limited class
      // (per §14.4).
      const isRateLimited = err instanceof AdapterRateLimitedError
      if (isRateLimited) {
        await drainBucket(db, channelScopeKey(channel.id, connectionId), err.retryAfterMs)
      }
      await envelope.complete({
        errorClass: isRateLimited ? "rate_limited" : "adapter_error",
        errorMessage: message,
      })
      await markLinkFailed(db, link.id, link.pushAttempts + 1, message)
      outcomes.push({
        channelId: channel.id,
        bookingItemId: link.bookingItemId ?? null,
        status: "failed",
        error: message,
      })
      failed += 1
      logger.error?.(`pushBooking failed for ${link.id}`, { error: message })
    }
  }

  // Compensation pass: if any link failed and the channel-contract
  // policy is strict-atomic, roll back succeeded siblings so all
  // channels see a consistent "no booking" state. Per §4.2.
  let compensated = 0
  if (failed > 0 && successList.length > 0) {
    const policy = await resolveCompensationPolicy(db, links[0]?.channel.id ?? null)
    if (policy === "strict-atomic") {
      for (const entry of successList) {
        const success = await compensateSucceededLink(db, entry, input.bookingId, logger)
        if (success) {
          compensated += 1
          // Update the existing outcome row to compensated.
          for (const outcome of outcomes) {
            if (
              outcome.channelId === entry.channel.id &&
              outcome.bookingItemId === (entry.link.bookingItemId ?? null) &&
              outcome.status === "ok"
            ) {
              outcome.status = "compensated"
              break
            }
          }
        }
      }
      if (compensated > 0) {
        logger.warn?.(
          `processBookingPush: compensated ${compensated} succeeded link(s) under strict-atomic policy`,
          { bookingId: input.bookingId, compensated, failed },
        )
      }
    }
  }

  return {
    bookingId: input.bookingId,
    attempted: links.length,
    succeeded,
    failed,
    compensated,
    outcomes,
  }
}
