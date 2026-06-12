/**
 * Availability-push pipeline.
 *
 * Triggered by `availability.slot.changed`. The subscriber upserts a
 * `channel_availability_push_intents` row per (channel, slot) — concurrent
 * supersession events collapse to one row via the unique constraint.
 * The processor (`processAvailabilityPushIntents`) drains intents per
 * channel, reads the *current* slot state, and dispatches via
 * `adapter.pushAvailability()`. Stale-event protection comes from
 * reading current state at processing time, not the event payload.
 *
 * Per docs/architecture/channel-push-architecture.md §5 + §12.2.
 */

import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  AdapterRateLimitedError,
  type PushAvailabilityRequest,
  type SourceAdapterContext,
} from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { acquireToken, channelScopeKey, drainBucket, type RateLimitConfig } from "../rate-limit.js"
import {
  channelAvailabilityPushIntents,
  channelInventoryAllotments,
  channelProductMappings,
  channels,
} from "../schema.js"
import { prepareOutboundEnvelope } from "../webhook-deliveries.js"

import { type ChannelPushDeps, defaultLogger, getChannelPushDepsOrThrow } from "./types.js"

/** Stable string identifier for the availability-push workflow. */
export const CHANNEL_AVAILABILITY_PUSH_WORKFLOW_ID = "channel.availability.push" as const

export interface ResolveAllotmentTargetsForSlotInput {
  slotId: string
  productId: string
  optionId: string | null
}

/**
 * Resolve the channels that hold an allotment for this slot/product/option.
 * Per §7.4 — availability push uses `channel_inventory_allotments` (NOT
 * `channel_product_mappings`), so channels mapped to the product but
 * with no per-slot allotment don't receive pushes.
 *
 * v1 returns one row per channel that has an active allotment whose
 * scope matches the slot (by product, optionally by option). Per-slot
 * targeting via `channel_inventory_allotment_targets` is consulted in a
 * future iteration; v1 dispatches at allotment-level so any allotment
 * row covering the product/option triggers a push.
 */
export async function resolveAllotmentTargetsForSlot(
  db: AnyDrizzleDb,
  input: ResolveAllotmentTargetsForSlotInput,
): Promise<
  Array<{
    channelId: string
    sourceConnectionId: string
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>
> {
  // Resolve allotments for this product (optionally option-scoped).
  const allotmentRows = (await db
    .select({
      channelId: channelInventoryAllotments.channelId,
    })
    .from(channelInventoryAllotments)
    .innerJoin(channels, eq(channelInventoryAllotments.channelId, channels.id))
    .where(
      and(
        eq(channelInventoryAllotments.productId, input.productId),
        eq(channelInventoryAllotments.active, true),
        eq(channels.status, "active"),
        input.optionId
          ? // agent-quality: raw-sql reviewed -- owner: distribution; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`(${channelInventoryAllotments.optionId} IS NULL OR ${channelInventoryAllotments.optionId} = ${input.optionId})`
          : // agent-quality: raw-sql reviewed -- owner: distribution; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${channelInventoryAllotments.optionId} IS NULL`,
      ),
    )) as Array<{ channelId: string }>

  if (allotmentRows.length === 0) return []

  const channelIds = Array.from(new Set(allotmentRows.map((r) => r.channelId)))

  const mappings = (await db
    .select({
      mapping: channelProductMappings,
      channel: channels,
    })
    .from(channelProductMappings)
    .innerJoin(channels, eq(channelProductMappings.channelId, channels.id))
    .where(
      and(
        eq(channelProductMappings.productId, input.productId),
        eq(channelProductMappings.active, true),
        eq(channelProductMappings.pushAvailability, true),
        inArray(channelProductMappings.channelId, channelIds),
      ),
    )) as Array<{
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  return mappings
    .filter((row) => row.mapping.sourceConnectionId)
    .map((row) => ({
      channelId: row.channel.id,
      sourceConnectionId: row.mapping.sourceConnectionId!,
      mapping: row.mapping,
      channel: row.channel,
    }))
}

/**
 * Insert/update an intent row per (channel, slot). The unique
 * constraint on `(channel_id, slot_id)` collapses concurrent
 * supersession events to one row; the worker reads the *current* slot
 * state when it processes, so stale event payloads never propagate.
 */
export async function upsertAvailabilityIntent(
  db: AnyDrizzleDb,
  input: {
    channelId: string
    sourceConnectionId: string
    slotId: string
    productId: string
    optionId: string | null
    startsAt: Date
  },
): Promise<void> {
  await db
    .insert(channelAvailabilityPushIntents)
    .values({
      id: newId("channel_availability_push_intents"),
      channelId: input.channelId,
      sourceConnectionId: input.sourceConnectionId,
      slotId: input.slotId,
      productId: input.productId,
      optionId: input.optionId,
      startsAt: input.startsAt,
    })
    .onConflictDoUpdate({
      target: [channelAvailabilityPushIntents.channelId, channelAvailabilityPushIntents.slotId],
      set: {
        requestedAt: new Date(),
        updatedAt: new Date(),
        // Reset attempts when a new event lands — fresh chance.
        attempts: 0,
        lastError: null,
      },
    })
}

export interface ProcessAvailabilityPushInput {
  /** When set, drain intents only for this channel. Otherwise drain all. */
  channelId?: string
  /** Max intents to process per call (across all channels). Default 100. */
  limit?: number
}

export interface ProcessAvailabilityPushResult {
  attempted: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Drain pending availability intents. Reads CURRENT slot state for each
 * intent (so superseded values never propagate). On success, deletes the
 * intent row. On failure, increments `attempts` and stamps `last_error`.
 *
 * Per §5.3 + §12.2.
 */
export async function processAvailabilityPushIntents(
  input: ProcessAvailabilityPushInput = {},
  deps?: ChannelPushDeps,
): Promise<ProcessAvailabilityPushResult> {
  const { db, registry, logger = defaultLogger } = deps ?? getChannelPushDepsOrThrow()
  const limit = input.limit ?? 100

  const intents = (await db
    .select({
      intent: channelAvailabilityPushIntents,
      channel: channels,
    })
    .from(channelAvailabilityPushIntents)
    .innerJoin(channels, eq(channelAvailabilityPushIntents.channelId, channels.id))
    .where(
      and(
        input.channelId ? eq(channelAvailabilityPushIntents.channelId, input.channelId) : sql`true`,
        eq(channels.status, "active"),
      ),
    )
    .orderBy(asc(channelAvailabilityPushIntents.requestedAt))
    .limit(limit)) as Array<{
    intent: typeof channelAvailabilityPushIntents.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const { intent, channel } of intents) {
    // Read current slot state — stale events naturally don't propagate.
    const [slot] = (await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, intent.slotId))
      .limit(1)) as Array<typeof availabilitySlots.$inferSelect>

    if (!slot) {
      // Slot deleted; drop the intent. Reconciler covers any drift.
      await db
        .delete(channelAvailabilityPushIntents)
        .where(eq(channelAvailabilityPushIntents.id, intent.id))
      skipped += 1
      continue
    }

    const adapter = registry.resolveByConnection(intent.sourceConnectionId)
    if (!adapter?.capabilities.supportsAvailabilityPush || !adapter.pushAvailability) {
      await stampIntentError(
        db,
        intent.id,
        intent.attempts + 1,
        adapter ? "adapter_unsupported" : "no_adapter_registered",
      )
      failed += 1
      continue
    }

    // Look up external ids via channel_product_mappings.
    const [mapping] = (await db
      .select()
      .from(channelProductMappings)
      .where(
        and(
          eq(channelProductMappings.channelId, channel.id),
          eq(channelProductMappings.productId, intent.productId),
        ),
      )
      .limit(1)) as Array<typeof channelProductMappings.$inferSelect>

    if (!mapping) {
      await stampIntentError(db, intent.id, intent.attempts + 1, "no_mapping")
      failed += 1
      continue
    }

    // Rate limit before dispatching. Availability uses the gated
    // priority (default 0.3) so bookings always pre-empt.
    const rlConfig = rateLimitConfigForChannel(channel)
    if (rlConfig) {
      const acq = await acquireToken(
        db,
        channelScopeKey(channel.id, intent.sourceConnectionId),
        rlConfig,
        "availability",
      )
      if (!acq.acquired) {
        // Per §14.3: availability denials don't sleep. The next event
        // for the same key supersedes; intent stays for next pass.
        await stampIntentError(db, intent.id, intent.attempts + 1, "rate_limited")
        failed += 1
        continue
      }
    }

    const request: PushAvailabilityRequest = {
      channelId: channel.id,
      externalProductId: mapping.externalProductId ?? "",
      externalRateId: mapping.externalRateId ?? undefined,
      externalCategoryId: mapping.externalCategoryId ?? undefined,
      slotId: slot.id,
      productId: slot.productId,
      optionId: slot.optionId ?? undefined,
      startsAt: slot.startsAt,
      remainingPax: slot.unlimited ? Number.MAX_SAFE_INTEGER : (slot.remainingPax ?? 0),
      source: "refresh",
    }

    const adapterCtx: SourceAdapterContext = {
      connection_id: intent.sourceConnectionId,
    }

    const envelope = await prepareOutboundEnvelope(db, {
      sourceModule: "distribution",
      sourceEvent: "channel.availability.push",
      sourceEntityModule: "availability",
      sourceEntityId: slot.id,
      targetUrl: `adapter:${adapter.kind}`,
      targetKind: `channel:${adapter.kind}`,
      targetRef: channel.id,
      requestMethod: "POST",
      requestBody: request,
      attemptNumber: intent.attempts + 1,
    })

    try {
      const result = await adapter.pushAvailability(adapterCtx, request)
      await envelope.complete({ responseStatus: 200, responseBody: result })
      // Drain on success.
      await db
        .delete(channelAvailabilityPushIntents)
        .where(eq(channelAvailabilityPushIntents.id, intent.id))
      succeeded += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isRateLimited = err instanceof AdapterRateLimitedError
      if (isRateLimited) {
        await drainBucket(
          db,
          channelScopeKey(channel.id, intent.sourceConnectionId),
          err.retryAfterMs,
        )
      }
      await envelope.complete({
        errorClass: isRateLimited ? "rate_limited" : "adapter_error",
        errorMessage: message,
      })
      await stampIntentError(db, intent.id, intent.attempts + 1, message)
      failed += 1
      logger.error?.(`pushAvailability failed for slot ${slot.id} channel ${channel.id}`, {
        error: message,
      })
    }
  }

  return {
    attempted: intents.length,
    succeeded,
    failed,
    skipped,
  }
}

async function stampIntentError(
  db: AnyDrizzleDb,
  id: string,
  attempts: number,
  message: string,
): Promise<void> {
  await db
    .update(channelAvailabilityPushIntents)
    .set({ attempts, lastError: message, updatedAt: new Date() })
    .where(eq(channelAvailabilityPushIntents.id, id))
}

function rateLimitConfigForChannel(channel: typeof channels.$inferSelect): RateLimitConfig | null {
  if (!channel.rateLimitRps || !channel.rateLimitBurst) return null
  return {
    rps: channel.rateLimitRps,
    burst: channel.rateLimitBurst,
    priorityGates: channel.rateLimitPriorityGates ?? undefined,
  }
}
