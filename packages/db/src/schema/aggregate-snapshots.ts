import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Read-through TTL snapshots for expensive aggregate computations —
 * primarily the admin dashboard `/aggregates` endpoints (bookings,
 * products, suppliers, finance, availability), which otherwise recompute
 * 3-11 live queries on every dashboard load.
 *
 * `key` is a semantic cache key, NOT a typeid — e.g.
 * `finance:aggregates:<paramsHash>`. Callers build it with
 * `aggregateSnapshotKey(...)` from `@voyant-travel/db/aggregate-snapshots`,
 * which folds query params into the key so distinct param sets get
 * distinct snapshots.
 *
 * `payload` is the JSON-serialized computation result; `staleAfter`
 * marks the end of the freshness window. Rows past `staleAfter` are
 * recomputed in place by the next reader (upsert, last write wins) —
 * stale rows are never served, so no sweeper is required, but a
 * periodic `DELETE WHERE stale_after < now() - interval '...'` keeps
 * abandoned keys from accumulating (hence the `stale_after` index).
 */
export const aggregateSnapshots = pgTable(
  "aggregate_snapshots",
  {
    key: text("key").primaryKey(),
    payload: jsonb("payload").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    staleAfter: timestamp("stale_after", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_aggregate_snapshots_stale_after").on(table.staleAfter)],
).enableRLS()

export type SelectAggregateSnapshot = typeof aggregateSnapshots.$inferSelect
export type InsertAggregateSnapshot = typeof aggregateSnapshots.$inferInsert
