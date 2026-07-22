/**
 * Sourced-entry store — durable provenance + projection capture for every
 * non-owned entity that lands in the catalog plane via `discover()`.
 *
 * This is the load-bearing prerequisite for the content cache, the read
 * service, drift invalidation, and snapshot capture. All of them assume
 * there's a durable local row per sourced entity that records *what we
 * know about it locally* — provenance (which adapter, which connection,
 * which upstream id), lifecycle (when first seen, when last seen, whether
 * still active), and the canonical local copy of the indexed projection.
 *
 * Owned entities do NOT have a row here — `provenance.source_kind ===
 * "owned"` reads provenance from the vertical's owned schema. The
 * sourced-entry store is sourced-only.
 *
 * See `docs/architecture/catalog-sourced-content.md` §2.5 for the full
 * design.
 */

import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import type { SourceFreshness } from "./contract.js"
import type { SourceKind } from "./provenance.js"

/**
 * Lifecycle status for a sourced entry. Independent of any drift / hold
 * the booking engine might apply — this tracks whether the upstream still
 * advertises the entity, not whether it's bookable right now.
 */
export type SourcedEntryStatus = "active" | "withdrawn" | "delisted"

/**
 * `catalog_sourced_entries` — single durable record per sourced entity,
 * keyed two ways: by Voyant-side `(entity_module, entity_id)` for
 * read-path lookup, and by upstream-side `(entity_module, source_kind,
 * source_connection_id, source_ref)` for discover-time
 * idempotency. The module is part of the identity because one upstream ref can
 * legitimately denote different presentation-subject kinds.
 *
 * The `projection` JSONB column is the canonical local copy of what
 * `adapter.discover()` returned. Read it for thin-content synthesis (when
 * the adapter declares `supportsContentFetch: false`) and for
 * provenance-aware dispatch — never the search index. Search indexes are
 * optimized for full-text/facet queries, not point-reads of rich detail.
 */
export const catalogSourcedEntriesTable = pgTable(
  "catalog_sourced_entries",
  {
    id: typeId("catalog_sourced_entries"),

    // Voyant-side identity (which vertical, which entity).
    entity_module: text("entity_module").notNull(),
    entity_id: text("entity_id").notNull(),

    // Provenance — mirrors `Provenance` interface, made durable.
    source_kind: text("source_kind").$type<SourceKind>().notNull(),
    source_provider: text("source_provider"),
    source_connection_id: text("source_connection_id"),
    source_ref: text("source_ref"),
    source_freshness: text("source_freshness").$type<SourceFreshness>().notNull(),
    last_sourced_at: timestamp("last_sourced_at", { withTimezone: true }),

    // Lifecycle.
    status: text("status").$type<SourcedEntryStatus>().notNull().default("active"),
    first_seen_at: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

    // Indexed-projection capture: denormalized snapshot of what
    // `discover()` returned, persisted locally so the thin-content
    // synthesizer and read service have a canonical source — NOT a search
    // index round-trip.
    projection: jsonb("projection").$type<Record<string, unknown>>().notNull(),
    projection_etag: text("projection_etag"),
    projection_seen_at: timestamp("projection_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Voyant-side lookup: one entity per (module, id).
    uniqueIndex("catalog_sourced_entries_entity_uniq").on(table.entity_module, table.entity_id),
    // Upstream-side idempotency. Separate partial indexes make a missing
    // connection an actual identity value (Postgres normally treats NULLs as
    // distinct) while allowing source_ref-less diagnostic rows.
    uniqueIndex("catalog_sourced_entries_source_connected_uniq")
      .on(
        table.entity_module,
        table.source_kind,
        table.source_connection_id,
        table.source_ref,
      )
      .where(
        sql`${table.source_connection_id} IS NOT NULL AND ${table.source_ref} IS NOT NULL`,
      ),
    uniqueIndex("catalog_sourced_entries_source_connectionless_uniq")
      .on(table.entity_module, table.source_kind, table.source_ref)
      .where(
        sql`${table.source_connection_id} IS NULL AND ${table.source_ref} IS NOT NULL`,
      ),
    // Per-vertical × source listings.
    index("catalog_sourced_entries_module_kind_idx").on(table.entity_module, table.source_kind),
    // Withdrawal sweepers — find rows that haven't been seen in N days.
    index("catalog_sourced_entries_status_seen_idx").on(table.status, table.last_seen_at),
    // Per-connection age — useful for "what hasn't this connection
    // refreshed lately" diagnostics.
    index("catalog_sourced_entries_connection_age_idx").on(
      table.source_kind,
      table.source_connection_id,
      table.last_sourced_at,
    ),
  ],
)

export type InsertCatalogSourcedEntry = typeof catalogSourcedEntriesTable.$inferInsert
export type SelectCatalogSourcedEntry = typeof catalogSourcedEntriesTable.$inferSelect
