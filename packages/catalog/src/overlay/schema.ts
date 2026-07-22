/**
 * Overlay store schema — editorial overrides keyed by
 * `(entity_module, entity_id, field_path, locale, audience, market)`.
 *
 * One overlay table serves every vertical. Rows hold the override value plus
 * provenance about *which* writer (admin UI / CMS plugin / bulk import / AI /
 * external API) produced the override, for audit and revert workflows.
 *
 * See `docs/architecture/catalog-architecture.md` §5.2 for the full design.
 */

import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import type { Visibility } from "../contract.js"

/**
 * Audit identifier indicating where an overlay row came from. Discriminated
 * by `kind`; consumers may pattern-match for revert / filter workflows.
 */
export type OverlayOrigin =
  | { kind: "admin-ui"; user_id: string }
  | { kind: "cms"; provider: string; cms_doc_id: string }
  | { kind: "bulk-import"; batch_id: string }
  | { kind: "ai-generated"; model: string; prompt_hash?: string }
  | { kind: "external-api"; api_key_id: string }

/**
 * Sentinel value used in `locale`, `audience`, and `market` columns to mark
 * "no specific scope" — the broadest fallback in the resolver chain.
 */
export const OVERLAY_DEFAULT_SCOPE = "default"
export const OVERLAY_ROOT_NODE_KIND = "root"
export const OVERLAY_ROOT_NODE_KEY = "root"

/**
 * `catalog_overlay` — single table holding editorial overrides for every
 * vertical. Composite uniqueness on `(entity_module, entity_id, field_path,
 * locale, audience, market)` prevents duplicate overlays for the same scope.
 */
export const catalogOverlayTable = pgTable(
  "catalog_overlay",
  {
    id: typeId("catalog_overlay"),

    // Entity identity (which vertical, which entity).
    entity_module: text("entity_module").notNull(),
    entity_id: text("entity_id").notNull(),

    // Stable content-node identity. Existing flat overlays are root/root.
    // Nested overlays must target a stable node key, never an array position.
    node_kind: text("node_kind").notNull().default(OVERLAY_ROOT_NODE_KIND),
    node_key: text("node_key").notNull().default(OVERLAY_ROOT_NODE_KEY),

    // Field-policy path the override targets. Validated against the vertical's
    // field policy at write time (the policy must exist and must allow
    // overrides for the requesting editor role).
    field_path: text("field_path").notNull(),

    // Variant axes. Each defaults to OVERLAY_DEFAULT_SCOPE for entries that
    // apply across the broadest scope.
    locale: text("locale").notNull().default(OVERLAY_DEFAULT_SCOPE),
    audience: text("audience")
      .$type<Visibility | typeof OVERLAY_DEFAULT_SCOPE>()
      .notNull()
      .default(OVERLAY_DEFAULT_SCOPE),
    market: text("market").notNull().default(OVERLAY_DEFAULT_SCOPE),

    // Override value. JSONB to accommodate every field type (strings, lists,
    // structured objects, etc.). The resolver pairs this with the field policy
    // to apply the correct merge rule.
    value: jsonb("value").notNull(),

    // Provenance: where this override came from.
    origin: jsonb("origin").$type<OverlayOrigin>().notNull(),

    // Optimistic concurrency token for human editorial writes.
    version: integer("version").notNull().default(1),

    // Optional note supplied by the writer for audit/review surfaces.
    editorial_note: text("editorial_note"),

    // Soft-delete. When set, the row is preserved for retention / restore but
    // no longer active in the resolver merge.
    deleted_at: timestamp("deleted_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The variant-tuple identifies one overlay row uniquely. `WHERE deleted_at
    // IS NULL` is enforced via partial unique index so soft-deleted rows can
    // be re-created without conflict.
    uniqueIndex("catalog_overlay_variant_uniq")
      .on(
        table.entity_module,
        table.entity_id,
        table.node_kind,
        table.node_key,
        table.field_path,
        table.locale,
        table.audience,
        table.market,
      )
      // agent-quality: raw-sql reviewed -- owner: catalog; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.deleted_at} IS NULL`),
    // Lookup index for the resolver: given an entity, find all its active
    // overlays in one query.
    index("catalog_overlay_entity_idx").on(table.entity_module, table.entity_id, table.deleted_at),
    // Lookup index for cross-source queries: find overlays by origin (e.g.
    // "all overlays from this CMS plugin" for revert / re-sync workflows).
    index("catalog_overlay_origin_idx").on(table.origin),
  ],
)

export const catalogOverlayHistoryTable = pgTable(
  "catalog_overlay_history",
  {
    id: text("id").primaryKey(),
    overlay_id: typeIdRef("overlay_id"),

    entity_module: text("entity_module").notNull(),
    entity_id: text("entity_id").notNull(),
    node_kind: text("node_kind").notNull().default(OVERLAY_ROOT_NODE_KIND),
    node_key: text("node_key").notNull().default(OVERLAY_ROOT_NODE_KEY),
    field_path: text("field_path").notNull(),
    locale: text("locale").notNull().default(OVERLAY_DEFAULT_SCOPE),
    audience: text("audience")
      .$type<Visibility | typeof OVERLAY_DEFAULT_SCOPE>()
      .notNull()
      .default(OVERLAY_DEFAULT_SCOPE),
    market: text("market").notNull().default(OVERLAY_DEFAULT_SCOPE),

    action: text("action").$type<"write" | "clear" | "restore">().notNull(),
    previous_value: jsonb("previous_value"),
    next_value: jsonb("next_value"),
    previous_version: integer("previous_version"),
    next_version: integer("next_version"),
    origin: jsonb("origin").$type<OverlayOrigin>().notNull(),
    editorial_note: text("editorial_note"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("catalog_overlay_history_overlay_idx").on(table.overlay_id),
    index("catalog_overlay_history_target_idx").on(
      table.entity_module,
      table.entity_id,
      table.node_kind,
      table.node_key,
      table.field_path,
      table.locale,
    ),
  ],
)

export type InsertCatalogOverlay = typeof catalogOverlayTable.$inferInsert
export type SelectCatalogOverlay = typeof catalogOverlayTable.$inferSelect
export type InsertCatalogOverlayHistory = typeof catalogOverlayHistoryTable.$inferInsert
export type SelectCatalogOverlayHistory = typeof catalogOverlayHistoryTable.$inferSelect

/**
 * Foreign-key column helper for tables that reference an overlay row.
 * Rare — consumers typically query overlays by entity, not by FK.
 */
export const overlayIdRef = (columnName: string) => typeIdRef(columnName)
