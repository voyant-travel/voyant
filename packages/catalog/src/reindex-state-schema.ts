import { sql } from "drizzle-orm"
import { bigint, check, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Durable, tenant-scoped cursor and lease for a coalesced Catalog product
 * reindex generation.
 */
export const catalogProductReindexStateTable = pgTable(
  "catalog_product_reindex_state",
  {
    tenantId: text("tenant_id").notNull(),
    reindexKey: text("reindex_key").notNull(),
    requestedGeneration: bigint("requested_generation", { mode: "number" }).notNull().default(0),
    claimedGeneration: bigint("claimed_generation", { mode: "number" }),
    completedGeneration: bigint("completed_generation", { mode: "number" }).notNull().default(0),
    cursorAfterId: text("cursor_after_id"),
    batches: integer("batches").notNull().default(0),
    scanned: integer("scanned").notNull().default(0),
    indexed: integer("indexed").notNull().default(0),
    retries: integer("retries").notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "catalog_product_reindex_state_pk",
      columns: [table.tenantId, table.reindexKey],
    }),
    check(
      "catalog_product_reindex_state_requested_nonnegative",
      sql`${table.requestedGeneration} >= 0`,
    ),
    check(
      "catalog_product_reindex_state_completed_nonnegative",
      sql`${table.completedGeneration} >= 0`,
    ),
    check(
      "catalog_product_reindex_state_counters_nonnegative",
      sql`${table.batches} >= 0 AND ${table.scanned} >= 0 AND ${table.indexed} >= 0 AND ${table.retries} >= 0`,
    ),
  ],
)

export type SelectCatalogProductReindexState = typeof catalogProductReindexStateTable.$inferSelect
export type InsertCatalogProductReindexState = typeof catalogProductReindexStateTable.$inferInsert
