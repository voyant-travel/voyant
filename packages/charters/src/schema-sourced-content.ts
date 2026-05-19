/**
 * Charters sourced-content cache. Sibling to the products / cruises /
 * accommodations variants — same shape, different vertical.
 *
 * One row per sourced charter product × locale × market. Stores the
 * rich detail-page content the upstream adapter served via
 * `getContent`, plus the SWR metadata the read service needs.
 *
 * The charters vertical's catalog entry is the **charter product**
 * (the sellable yacht-charter offering — per-suite or whole-yacht).
 * Sourced charter products from MYBA fleets, broker pools, or charter
 * operators store the product summary, yacht spec, voyage schedule,
 * and policies all in one payload via `getContent`.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export type ChartersSourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

export const CHARTERS_CONTENT_MARKET_ANY = "*"

export const chartersSourcedContentTable = pgTable(
  "charters_sourced_content",
  {
    /** TypeID matching the charters module — `chrt_*` (charter_products). */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag. */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(CHARTERS_CONTENT_MARKET_ANY),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    content_schema_version: text("content_schema_version").notNull(),

    returned_locale: text("returned_locale").notNull(),
    machine_translated: boolean("machine_translated").notNull().default(false),

    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    etag: text("etag"),

    fetch_status: text("fetch_status")
      .$type<ChartersSourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    index("charters_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    index("charters_sourced_content_returned_locale_idx").on(
      table.entity_id,
      table.returned_locale,
    ),
    index("charters_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertChartersSourcedContent = typeof chartersSourcedContentTable.$inferInsert
export type SelectChartersSourcedContent = typeof chartersSourcedContentTable.$inferSelect
