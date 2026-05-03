/**
 * Content-push pipeline.
 *
 * Triggered by `product.content.changed`. The subscriber upserts a
 * `channel_content_push_intents` row per (channel, product); concurrent
 * edits collapse to one row. The processor drains intents, hashes the
 * current content, and skips when the hash equals
 * `channel_product_mappings.last_pushed_content_hash` — channel-side
 * idempotency per §6.1.
 *
 * Per docs/architecture/channel-push-architecture.md §6 + §12.3.
 */

import type { PushContentRequest, SourceAdapterContext } from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import { products } from "@voyantjs/products/schema"
import { and, asc, eq, sql } from "drizzle-orm"
import { acquireToken, channelScopeKey, type RateLimitConfig } from "../rate-limit.js"
import { channelContentPushIntents, channelProductMappings, channels } from "../schema.js"
import { prepareOutboundEnvelope } from "../webhook-deliveries.js"

import { type ChannelPushDeps, defaultLogger, getChannelPushDepsOrThrow } from "./types.js"

/** Stable string identifier for the content-push workflow. */
export const CHANNEL_CONTENT_PUSH_WORKFLOW_ID = "channel.content.push" as const

/**
 * Resolve the channels that want a content push for this product.
 * Per §7.4 — content push uses `channel_product_mappings` (content is
 * product-shaped, not slot-shaped).
 */
export async function resolveContentPushTargets(
  db: AnyDrizzleDb,
  productId: string,
): Promise<
  Array<{
    channelId: string
    sourceConnectionId: string
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>
> {
  const rows = (await db
    .select({
      mapping: channelProductMappings,
      channel: channels,
    })
    .from(channelProductMappings)
    .innerJoin(channels, eq(channelProductMappings.channelId, channels.id))
    .where(
      and(
        eq(channelProductMappings.productId, productId),
        eq(channelProductMappings.active, true),
        eq(channelProductMappings.pushContent, true),
        eq(channels.status, "active"),
      ),
    )) as Array<{
    mapping: typeof channelProductMappings.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  return rows
    .filter((row) => row.mapping.sourceConnectionId)
    .map((row) => ({
      channelId: row.channel.id,
      sourceConnectionId: row.mapping.sourceConnectionId!,
      mapping: row.mapping,
      channel: row.channel,
    }))
}

export async function upsertContentIntent(
  db: AnyDrizzleDb,
  input: { channelId: string; sourceConnectionId: string; productId: string },
): Promise<void> {
  await db
    .insert(channelContentPushIntents)
    .values({
      id: newId("channel_content_push_intents"),
      channelId: input.channelId,
      sourceConnectionId: input.sourceConnectionId,
      productId: input.productId,
    })
    .onConflictDoUpdate({
      target: [channelContentPushIntents.channelId, channelContentPushIntents.productId],
      set: {
        requestedAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        lastError: null,
      },
    })
}

export interface ProcessContentPushInput {
  channelId?: string
  limit?: number
}

export interface ProcessContentPushResult {
  attempted: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Drain pending content intents. Hashes current product content and
 * skips when the hash matches the upstream's last-known hash.
 *
 * v1 ships a minimal `content` payload (product row fields). Real
 * verticals supply richer payloads via a future content provider hook.
 *
 * Per §6 + §12.3.
 */
export async function processContentPushIntents(
  input: ProcessContentPushInput = {},
  deps?: ChannelPushDeps,
): Promise<ProcessContentPushResult> {
  const { db, registry, logger = defaultLogger } = deps ?? getChannelPushDepsOrThrow()
  const limit = input.limit ?? 100

  const intents = (await db
    .select({
      intent: channelContentPushIntents,
      channel: channels,
    })
    .from(channelContentPushIntents)
    .innerJoin(channels, eq(channelContentPushIntents.channelId, channels.id))
    .where(
      and(
        input.channelId ? eq(channelContentPushIntents.channelId, input.channelId) : sql`true`,
        eq(channels.status, "active"),
      ),
    )
    .orderBy(asc(channelContentPushIntents.requestedAt))
    .limit(limit)) as Array<{
    intent: typeof channelContentPushIntents.$inferSelect
    channel: typeof channels.$inferSelect
  }>

  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const { intent, channel } of intents) {
    const [product] = (await db
      .select()
      .from(products)
      .where(eq(products.id, intent.productId))
      .limit(1)) as Array<typeof products.$inferSelect>

    if (!product) {
      await db.delete(channelContentPushIntents).where(eq(channelContentPushIntents.id, intent.id))
      skipped += 1
      continue
    }

    const adapter = registry.resolveByConnection(intent.sourceConnectionId)
    if (!adapter?.capabilities.supportsContentPush || !adapter.pushContent) {
      await stampIntentError(
        db,
        intent.id,
        intent.attempts + 1,
        adapter ? "adapter_unsupported" : "no_adapter_registered",
      )
      failed += 1
      continue
    }

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

    // Build the content payload + hash. v1 = product row fields. Future
    // iterations call a per-vertical content provider so the payload
    // mirrors `GetContentResult` (itinerary, media, options, …).
    const content = buildMinimalContent(product)
    const contentHash = canonicalHash(content)

    // Idempotency: skip when the upstream's last-known hash equals
    // the current hash. Per §6.1.
    if (mapping.lastPushedContentHash === contentHash) {
      await db.delete(channelContentPushIntents).where(eq(channelContentPushIntents.id, intent.id))
      skipped += 1
      continue
    }

    const rlConfig = rateLimitConfigForChannel(channel)
    if (rlConfig) {
      const acq = await acquireToken(
        db,
        channelScopeKey(channel.id, intent.sourceConnectionId),
        rlConfig,
        "content",
      )
      if (!acq.acquired) {
        await stampIntentError(db, intent.id, intent.attempts + 1, "rate_limited")
        failed += 1
        continue
      }
    }

    const request: PushContentRequest = {
      channelId: channel.id,
      externalProductId: mapping.externalProductId ?? "",
      productId: intent.productId,
      contentHash,
      content,
      contentSchemaVersion: "products/v1",
    }

    const adapterCtx: SourceAdapterContext = {
      connection_id: intent.sourceConnectionId,
    }

    const envelope = await prepareOutboundEnvelope(db, {
      sourceModule: "distribution",
      sourceEvent: "channel.content.push",
      sourceEntityModule: "products",
      sourceEntityId: intent.productId,
      targetUrl: `adapter:${adapter.kind}`,
      targetKind: `channel:${adapter.kind}`,
      targetRef: channel.id,
      requestMethod: "POST",
      requestBody: request,
      attemptNumber: intent.attempts + 1,
    })

    try {
      const result = await adapter.pushContent(adapterCtx, request)
      await envelope.complete({ responseStatus: 200, responseBody: result })
      // Persist the acknowledged hash so subsequent pushes skip if
      // content hasn't changed. Per §6.1.
      await db
        .update(channelProductMappings)
        .set({
          lastPushedContentHash: result.acknowledgedHash ?? contentHash,
          lastPushedContentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(channelProductMappings.id, mapping.id))
      await db.delete(channelContentPushIntents).where(eq(channelContentPushIntents.id, intent.id))
      succeeded += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await envelope.complete({ errorClass: "adapter_error", errorMessage: message })
      await stampIntentError(db, intent.id, intent.attempts + 1, message)
      failed += 1
      logger.error?.(`pushContent failed for product ${intent.productId} channel ${channel.id}`, {
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
    .update(channelContentPushIntents)
    .set({ attempts, lastError: message, updatedAt: new Date() })
    .where(eq(channelContentPushIntents.id, id))
}

function rateLimitConfigForChannel(channel: typeof channels.$inferSelect): RateLimitConfig | null {
  if (!channel.rateLimitRps || !channel.rateLimitBurst) return null
  return {
    rps: channel.rateLimitRps,
    burst: channel.rateLimitBurst,
    priorityGates: channel.rateLimitPriorityGates ?? undefined,
  }
}

function buildMinimalContent(product: typeof products.$inferSelect): Record<string, unknown> {
  // v1 minimal shape — enough for the demo upstream to acknowledge.
  // Production wiring composes per-vertical content (itinerary, media,
  // options, …) per the doc's `GetContentResult`.
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
  }
}

/**
 * Stable canonical-JSON hash. Mirrors the body-fingerprint behavior
 * of `webhook-deliveries.ts` — purely a "is this the same content as
 * before?" fingerprint, not a cryptographic hash.
 */
export function canonicalHash(value: unknown): string {
  let text: string
  try {
    text = canonicalJson(value)
  } catch {
    text = String(value)
  }
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i))
    h = (h * prime) & mask
  }
  return h.toString(16).padStart(16, "0")
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`,
  )
  return `{${parts.join(",")}}`
}
