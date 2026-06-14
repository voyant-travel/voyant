import { bookingItems, type bookings } from "@voyant-travel/bookings/schema"
import type { SourceAdapter, SourceAdapterContext } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  channelBookingLinks,
  channelContracts,
  channelProductMappings,
  type channels,
} from "@voyant-travel/distribution/schema"
import { and, asc, eq, lte, or, sql } from "drizzle-orm"

import type { RateLimitConfig } from "../rate-limit.js"
import { prepareOutboundEnvelope } from "../webhook-deliveries.js"

import type { CompensationPolicy } from "./booking-push.js"

/**
 * Read the compensation policy for a channel by walking
 * `channel_contracts` (most-recent active contract wins). Returns
 * `eventually-consistent` when no contract exists or no compensation
 * key is set — that's the doc-default safe behavior for travel
 * inventory.
 */
export async function resolveCompensationPolicy(
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
        // agent-quality: raw-sql reviewed -- owner: distribution; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
export async function compensateSucceededLink(
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

export async function markLinkOk(
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

export async function markLinkFailed(
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

export async function readMappingForLink(
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

export function rateLimitConfigForChannel(
  channel: typeof channels.$inferSelect,
): RateLimitConfig | null {
  if (!channel.rateLimitRps || !channel.rateLimitBurst) return null
  return {
    rps: channel.rateLimitRps,
    burst: channel.rateLimitBurst,
    priorityGates: channel.rateLimitPriorityGates ?? undefined,
  }
}

export function serializeBookingForPush(
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
