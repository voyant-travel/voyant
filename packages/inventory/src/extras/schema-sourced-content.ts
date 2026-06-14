/**
 * Extras sourced-content cache. Sibling to the products / cruises /
 * accommodations / charters variants — same shape, different vertical.
 *
 * One row per sourced extra × locale × market. Stores the content the
 * upstream adapter served via `getContent`, plus the SWR metadata the
 * read service needs.
 *
 * Extras are booking add-ons (optional line items layered on a parent
 * product). Per `catalog-policy.ts`, extras are a partial-adoption
 * vertical: they don't appear in the search index, but sourced extras
 * (e.g. a TUI excursion add-on) still need rich content for the
 * booking-flow's add-on selection UI. The sourced-content cache covers
 * exactly that surface.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export type ExtrasSourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

export const EXTRAS_CONTENT_MARKET_ANY = "*"

export const extrasSourcedContentTable = pgTable(
  "extras_sourced_content",
  {
    /** TypeID matching the extras module — `pxtr_*` (product_extras). */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag. */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(EXTRAS_CONTENT_MARKET_ANY),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    content_schema_version: text("content_schema_version").notNull(),

    returned_locale: text("returned_locale").notNull(),
    machine_translated: boolean("machine_translated").notNull().default(false),

    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    etag: text("etag"),

    fetch_status: text("fetch_status")
      .$type<ExtrasSourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    index("extras_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    index("extras_sourced_content_returned_locale_idx").on(table.entity_id, table.returned_locale),
    index("extras_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertExtrasSourcedContent = typeof extrasSourcedContentTable.$inferInsert
export type SelectExtrasSourcedContent = typeof extrasSourcedContentTable.$inferSelect
