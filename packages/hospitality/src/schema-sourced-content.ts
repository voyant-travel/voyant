/**
 * Hospitality sourced-content cache. Sibling to
 * `products_sourced_content` and `cruises_sourced_content` — same
 * shape, different vertical.
 *
 * One row per sourced room-type × locale × market. Stores the rich
 * detail-page content the upstream adapter served via `getContent`,
 * plus the SWR metadata the read service needs.
 *
 * The hospitality vertical's catalog entry is the **room type** (the
 * sellable variant within a property). Sourced room types — bedbank
 * inventory like Hotelbeds / Expedia — store the property summary,
 * room types, rate plans, meal plans, and amenities all in one
 * payload via `getContent`.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export type HospitalitySourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

export const HOSPITALITY_CONTENT_MARKET_ANY = "*"

export const hospitalitySourcedContentTable = pgTable(
  "hospitality_sourced_content",
  {
    /**
     * TypeID matching the hospitality module — `hrmt_*` (room_types).
     * Sourced rows share the same TypeID prefix as owned rows; the
     * sourced-entry table distinguishes them by provenance.
     */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag. */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(HOSPITALITY_CONTENT_MARKET_ANY),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    content_schema_version: text("content_schema_version").notNull(),

    returned_locale: text("returned_locale").notNull(),
    machine_translated: boolean("machine_translated").notNull().default(false),

    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    etag: text("etag"),

    fetch_status: text("fetch_status")
      .$type<HospitalitySourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    index("hospitality_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    index("hospitality_sourced_content_returned_locale_idx").on(
      table.entity_id,
      table.returned_locale,
    ),
    index("hospitality_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertHospitalitySourcedContent = typeof hospitalitySourcedContentTable.$inferInsert
export type SelectHospitalitySourcedContent = typeof hospitalitySourcedContentTable.$inferSelect
