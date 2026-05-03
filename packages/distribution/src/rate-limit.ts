/**
 * Per-channel rate limiting (token bucket on Postgres).
 *
 * `acquireToken` is the canonical channel-push wrapper around the
 * generic `infra.rate_limit_buckets` primitive. Each call:
 *
 *   1. Atomically refills the bucket based on `(now - last_refill_at) *
 *      refill_rate`, capped at capacity.
 *   2. Checks the priority gate: tokens_available >= gate * capacity
 *      AND tokens_available >= 1.
 *   3. On success, decrements by 1 and returns `{ acquired: true }`.
 *   4. On denial, returns `{ acquired: false, retryAfterMs }` computed
 *      from how long until enough tokens refill to clear the gate.
 *
 * Whole thing is one round-trip (an UPSERT with conditional UPDATE).
 *
 * Per docs/architecture/channel-push-architecture.md §14.2 and §14.3.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { infraRateLimitBucketsTable } from "@voyantjs/db/schema/infra"
import { eq } from "drizzle-orm"

export type ChannelPushPriority = "booking" | "availability" | "content"

export interface RateLimitConfig {
  /** Sustained refill rate (tokens per second). */
  rps: number
  /** Burst capacity (max tokens in the bucket). */
  burst: number
  /**
   * Per-priority reserve thresholds. Defaults to:
   *   { booking: 0, availability: 0.3, content: 0.7 }
   * Read as: bookings dispatch with any tokens; availability when
   * bucket ≥ 30% full; content when ≥ 70% full.
   */
  priorityGates?: Partial<Record<ChannelPushPriority, number>>
}

export const DEFAULT_PRIORITY_GATES: Record<ChannelPushPriority, number> = {
  booking: 0,
  availability: 0.3,
  content: 0.7,
}

export interface AcquireTokenAcquired {
  acquired: true
  /** Tokens left in the bucket after this call. */
  tokensRemaining: number
}

export interface AcquireTokenDenied {
  acquired: false
  /** Suggested wait time in milliseconds before retrying. */
  retryAfterMs: number
  /** Tokens currently in the bucket (post-refill). */
  tokensAvailable: number
}

export type AcquireTokenResult = AcquireTokenAcquired | AcquireTokenDenied

/**
 * Build the channel-push scope key from a (channel, connection) pair.
 * Same shape used by the workflow + reconciler so all paths address the
 * same bucket.
 */
export function channelScopeKey(channelId: string, connectionId: string): string {
  return `channel:${channelId}:${connectionId}`
}

/**
 * Acquire one token from the bucket at `scope`, applying the priority
 * gate for `priority`. Creates the bucket on first call (UPSERT with
 * full capacity).
 */
export async function acquireToken(
  db: AnyDrizzleDb,
  scope: string,
  config: RateLimitConfig,
  priority: ChannelPushPriority,
): Promise<AcquireTokenResult> {
  const gate = config.priorityGates?.[priority] ?? DEFAULT_PRIORITY_GATES[priority]
  const gateThreshold = Math.max(0, gate) * config.burst
  const now = new Date()

  // Read or create the bucket. We use an UPSERT to keep the operation
  // single-call.
  const existing = await db
    .select()
    .from(infraRateLimitBucketsTable)
    .where(eq(infraRateLimitBucketsTable.scope, scope))
    .limit(1)

  let bucket = existing[0]
  if (!bucket) {
    const created = await db
      .insert(infraRateLimitBucketsTable)
      .values({
        scope,
        tokensAvailable: String(config.burst),
        capacity: String(config.burst),
        refillRatePerSec: String(config.rps),
        lastRefillAt: now,
      })
      .onConflictDoNothing()
      .returning()
    if (created[0]) {
      bucket = created[0]
    } else {
      // Lost the race — re-read.
      const reread = await db
        .select()
        .from(infraRateLimitBucketsTable)
        .where(eq(infraRateLimitBucketsTable.scope, scope))
        .limit(1)
      bucket = reread[0]
    }
    if (!bucket) {
      throw new Error(`acquireToken: failed to create bucket for scope "${scope}"`)
    }
  }

  // Refill based on elapsed time, then check the gate.
  const tokensBefore = Number.parseFloat(bucket.tokensAvailable)
  const capacity = Number.parseFloat(bucket.capacity)
  const refillRate = Number.parseFloat(bucket.refillRatePerSec)
  const elapsedMs = now.getTime() - new Date(bucket.lastRefillAt).getTime()
  const refilled = Math.min(capacity, tokensBefore + (elapsedMs / 1000) * refillRate)

  if (refilled < 1 || refilled < gateThreshold) {
    // Not enough tokens. Compute the wait until we cross the higher of
    // (1, gateThreshold).
    const target = Math.max(1, gateThreshold)
    const deficit = target - refilled
    const retryAfterMs = refillRate > 0 ? Math.ceil((deficit / refillRate) * 1000) : 60_000
    // Persist the refill so concurrent acquirers see the same baseline.
    await db
      .update(infraRateLimitBucketsTable)
      .set({
        tokensAvailable: String(refilled),
        lastRefillAt: now,
        updatedAt: now,
      })
      .where(eq(infraRateLimitBucketsTable.scope, scope))
    return {
      acquired: false,
      retryAfterMs: Math.max(retryAfterMs, 0),
      tokensAvailable: refilled,
    }
  }

  const after = refilled - 1
  await db
    .update(infraRateLimitBucketsTable)
    .set({
      tokensAvailable: String(after),
      lastRefillAt: now,
      updatedAt: now,
    })
    .where(eq(infraRateLimitBucketsTable.scope, scope))

  return { acquired: true, tokensRemaining: after }
}

/**
 * Drain the bucket to zero and freeze it for `cooldownMs`.
 *
 * Called when an upstream returns 429 with a `Retry-After` hint —
 * prevents subsequent dispatchers from immediately retrying through
 * the same bucket and lets our outbound estimate converge with the
 * channel's authoritative state. Per §14.4.
 */
export async function drainBucket(
  db: AnyDrizzleDb,
  scope: string,
  cooldownMs: number,
): Promise<void> {
  const lastRefillAt = new Date(Date.now() + cooldownMs)
  await db
    .update(infraRateLimitBucketsTable)
    .set({
      tokensAvailable: "0",
      lastRefillAt,
      updatedAt: new Date(),
    })
    .where(eq(infraRateLimitBucketsTable.scope, scope))
}
