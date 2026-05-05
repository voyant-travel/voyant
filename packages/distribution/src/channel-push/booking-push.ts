/**
 * Booking-push pipeline.
 *
 * Triggered by `booking.confirmed`. The subscriber writes pending
 * `channel_booking_links` rows and returns immediately (per the EventBus
 * fire-and-forget contract). The durable processor (`processBookingPush`)
 * drains those rows, calls `adapter.pushBooking()` per link, and marks
 * each row `ok` or `failed`.
 *
 * The processor is a plain async function so it's callable from:
 *   - The `booking.confirmed` subscriber (inline, dev/single-process)
 *   - The `channel.booking.push` durable workflow's body (production)
 *   - The reconciler (Phase G) for catch-up after long outages
 *   - Tests / admin retry endpoints
 *
 * Per docs/architecture/channel-push-architecture.md §4 + §12.1.
 */

import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import {
  AdapterRateLimitedError,
  type PushBookingRequest,
  type SourceAdapter,
  type SourceAdapterContext,
} from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import {
  channelBookingLinks,
  channelContracts,
  channelProductMappings,
  channels,
} from "@voyantjs/distribution/schema"
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm"

import { acquireToken, channelScopeKey, drainBucket, type RateLimitConfig } from "../rate-limit.js"
import { prepareOutboundEnvelope } from "../webhook-deliveries.js"

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
 * Drain pending `channel_booking_links` rows for one booking and call
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
        eq(channelBookingLinks.pushStatus, "pending"),
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
    }
  }

  const [booking] = (await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1)) as Array<typeof bookings.$inferSelect>

  if (!booking) {
    logger.error?.(`processBookingPush: booking ${input.bookingId} not found`, {})
    return {
      bookingId: input.bookingId,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      compensated: 0,
      outcomes,
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

/**
 * Read the compensation policy for a channel by walking
 * `channel_contracts` (most-recent active contract wins). Returns
 * `eventually-consistent` when no contract exists or no compensation
 * key is set — that's the doc-default safe behavior for travel
 * inventory.
 */
async function resolveCompensationPolicy(
  db: AnyDrizzleDb,
  channelId: string | null,
): Promise<CompensationPolicy> {
  if (!channelId) return "eventually-consistent"
  const today = new Date().toISOString().slice(0, 10)
  const [contract] = (await db
    .select({ policy: channelContracts.policy })
    .from(channelContracts)
    .where(
      and(
        eq(channelContracts.channelId, channelId),
        eq(channelContracts.status, "active"),
        or(sql`${channelContracts.endsAt} IS NULL`, lte(channelContracts.startsAt, today)),
      ),
    )
    .orderBy(asc(channelContracts.startsAt))
    .limit(1)) as Array<{ policy: Record<string, unknown> | null }>

  const raw = contract?.policy?.compensation
  return raw === "strict-atomic" ? "strict-atomic" : "eventually-consistent"
}

/**
 * Roll back a succeeded link by calling `adapter.cancel` for the
 * upstream reference. Marks the link `compensated` regardless of the
 * cancel call's outcome — leaving it `ok` would lie to the operator
 * dashboard. Per §4.2.
 */
async function compensateSucceededLink(
  db: AnyDrizzleDb,
  entry: {
    link: typeof channelBookingLinks.$inferSelect
    channel: typeof channels.$inferSelect
    adapter: SourceAdapter
    adapterCtx: SourceAdapterContext
    upstreamRef: string
  },
  bookingId: string,
  logger: {
    error?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
  },
): Promise<boolean> {
  let cancelError: string | null = null
  if (entry.adapter.cancel) {
    const envelope = await prepareOutboundEnvelope(db, {
      sourceModule: "distribution",
      sourceEvent: "channel.booking.compensate",
      sourceEntityModule: "bookings",
      sourceEntityId: bookingId,
      targetUrl: `adapter:${entry.adapter.kind}`,
      targetKind: `channel:${entry.adapter.kind}`,
      targetRef: entry.channel.id,
      requestMethod: "POST",
      requestBody: { upstream_ref: entry.upstreamRef, reason: "channel-push-compensation" },
      attemptNumber: 1,
      idempotencyKey: `compensate:${entry.link.id}`,
    })
    try {
      const result = await entry.adapter.cancel(entry.adapterCtx, {
        upstream_ref: entry.upstreamRef,
        reason: "channel-push-compensation",
      })
      await envelope.complete({ responseStatus: 200, responseBody: result })
    } catch (err) {
      cancelError = err instanceof Error ? err.message : String(err)
      await envelope.complete({ errorClass: "adapter_error", errorMessage: cancelError })
      logger.warn?.(`compensateSucceededLink: cancel failed for ${entry.link.id}`, {
        error: cancelError,
      })
    }
  } else {
    cancelError = "adapter does not implement cancel"
    logger.warn?.(`compensateSucceededLink: ${entry.adapter.kind} has no cancel method`, {
      linkId: entry.link.id,
    })
  }

  const now = new Date()
  await db
    .update(channelBookingLinks)
    .set({
      pushStatus: "compensated",
      lastPushAt: now,
      lastError: cancelError,
      updatedAt: now,
    })
    .where(eq(channelBookingLinks.id, entry.link.id))
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function markLinkOk(
  db: AnyDrizzleDb,
  linkId: string,
  attempts: number,
  upstreamRef: string,
  externalReference: string | null,
  externalStatus: string | null,
): Promise<void> {
  const now = new Date()
  await db
    .update(channelBookingLinks)
    .set({
      pushStatus: "ok",
      pushAttempts: attempts,
      lastPushAt: now,
      lastError: null,
      externalBookingId: upstreamRef,
      externalReference,
      externalStatus,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(channelBookingLinks.id, linkId))
}

async function markLinkFailed(
  db: AnyDrizzleDb,
  linkId: string,
  attempts: number,
  message: string,
): Promise<void> {
  const now = new Date()
  await db
    .update(channelBookingLinks)
    .set({
      pushStatus: "failed",
      pushAttempts: attempts,
      lastPushAt: now,
      lastError: message,
      updatedAt: now,
    })
    .where(eq(channelBookingLinks.id, linkId))
}

async function readMappingForLink(
  db: AnyDrizzleDb,
  link: typeof channelBookingLinks.$inferSelect,
  booking: typeof bookings.$inferSelect,
): Promise<typeof channelProductMappings.$inferSelect | null> {
  // Walk via booking_items.product_id when the link is item-scoped;
  // otherwise pick the first mapping for any of the booking's items
  // (booking-level fallback used by bookings that fully syndicate).
  let productId: string | null = null
  if (link.bookingItemId) {
    const [row] = (await db
      .select({ productId: bookingItems.productId })
      .from(bookingItems)
      .where(eq(bookingItems.id, link.bookingItemId))
      .limit(1)) as Array<{ productId: string | null }>
    productId = row?.productId ?? null
  } else {
    const [row] = (await db
      .select({ productId: bookingItems.productId })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, booking.id))
      .limit(1)) as Array<{ productId: string | null }>
    productId = row?.productId ?? null
  }

  if (!productId) return null

  const [mapping] = (await db
    .select()
    .from(channelProductMappings)
    .where(
      and(
        eq(channelProductMappings.channelId, link.channelId),
        eq(channelProductMappings.productId, productId),
      ),
    )
    .limit(1)) as Array<typeof channelProductMappings.$inferSelect>

  return mapping ?? null
}

function rateLimitConfigForChannel(channel: typeof channels.$inferSelect): RateLimitConfig | null {
  if (!channel.rateLimitRps || !channel.rateLimitBurst) return null
  return {
    rps: channel.rateLimitRps,
    burst: channel.rateLimitBurst,
    priorityGates: channel.rateLimitPriorityGates ?? undefined,
  }
}

function serializeBookingForPush(
  booking: typeof bookings.$inferSelect,
  bookingItemId: string | null,
): Record<string, unknown> {
  // v1: ship a thin shape — booking number, dates, pax, optionally
  // narrowed to the targeted item. PII redaction (per §15) is left to
  // the adapter; future iterations push redaction up here.
  return {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    bookingItemId,
    status: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    pax: booking.pax,
    sellCurrency: booking.sellCurrency,
    sellAmountCents: booking.sellAmountCents,
  }
}
