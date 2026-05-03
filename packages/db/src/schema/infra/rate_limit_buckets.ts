import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { z } from "zod"

/**
 * Generic token-bucket rate-limit primitive.
 *
 * Any module that needs token-bucket rate limiting (channel push,
 * operator-configured webhooks, third-party integrations, future use
 * cases) uses this table with its own scope key. Channel push wraps it
 * with channel-specific scope construction:
 *
 *   "channel:" + channelId + ":" + connectionId
 *
 * The `acquireToken(scope, config, priority)` helper does the atomic
 * refill + decrement in one round-trip; see distribution's rate-limit
 * service for the canonical implementation.
 *
 * Per docs/architecture/channel-push-architecture.md §14.2.
 */
export const infraRateLimitBucketsTable = pgTable("rate_limit_buckets", {
  /**
   * Caller-defined scope. NOT a typeid — bucket scopes are application
   * level (e.g. `"channel:ch_xxx:conn_yyy"`). The PK doubles as the
   * lookup key.
   */
  scope: text("scope").primaryKey(),
  /**
   * Current token balance. `numeric` (not `integer`) so partial-token
   * priority gates work cleanly (e.g. "dispatch when bucket >= 0.3 *
   * capacity"). Drizzle returns this as a string; callers parse to
   * number.
   */
  tokensAvailable: numeric("tokens_available").notNull(),
  capacity: numeric("capacity").notNull(),
  /** Tokens added per second since `last_refill_at`. */
  refillRatePerSec: numeric("refill_rate_per_sec").notNull(),
  /**
   * Last time the bucket was refilled. Atomic UPDATE in `acquireToken`
   * computes `(now - last_refill_at) * refill_rate`, caps at capacity,
   * sets the new value, and stamps `last_refill_at = now()`.
   */
  lastRefillAt: timestamp("last_refill_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS()

export type InsertInfraRateLimitBucket = typeof infraRateLimitBucketsTable.$inferInsert
export type SelectInfraRateLimitBucket = typeof infraRateLimitBucketsTable.$inferSelect

export const infraRateLimitBucketSelectSchema = z.object({
  scope: z.string(),
  tokensAvailable: z.string(),
  capacity: z.string(),
  refillRatePerSec: z.string(),
  lastRefillAt: z.date(),
  updatedAt: z.date(),
})

export type InfraRateLimitBucket = z.infer<typeof infraRateLimitBucketSelectSchema>
