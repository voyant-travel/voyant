import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { typeId } from "../../lib/index.js"

/**
 * Idempotency keys store the response of a previously-handled request keyed
 * by `(scope, key)`. Replays of the same key with the same body hash return
 * the stored response; replays with a *different* body hash conflict (409).
 *
 * Designed for non-idempotent POST endpoints — primarily booking creation,
 * payment intent issuance, and similar money-affecting flows where a
 * client retry must not produce duplicate side effects.
 *
 * Rows expire after `expiresAt`. Cleanup is the deployment's responsibility
 * (typically a daily cron sweep).
 *
 * `scope` namespaces keys per endpoint family so that two unrelated
 * endpoints can safely accept overlapping keys without colliding.
 *
 * `bodyHash` is a SHA-256 of the canonical request body — when the same
 * key replays with the same hash, we return `responseStatus` /
 * `responseBody` verbatim. Different hash → 409.
 *
 * `referenceId` (optional) lets callers point at the resource the original
 * request created — typically a booking id — so that operational queries
 * can correlate replays with the underlying entity.
 */
export const infraIdempotencyKeysTable = pgTable(
  "idempotency_keys",
  {
    id: typeId("idempotency_keys"),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    bodyHash: text("body_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_infra_idempotency_keys_scope_key").on(table.scope, table.key),
    index("idx_infra_idempotency_keys_expires_at").on(table.expiresAt),
  ],
).enableRLS()

export type InsertInfraIdempotencyKey = typeof infraIdempotencyKeysTable.$inferInsert
export type SelectInfraIdempotencyKey = typeof infraIdempotencyKeysTable.$inferSelect
