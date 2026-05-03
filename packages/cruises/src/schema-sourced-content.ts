/**
 * Cruises sourced-content cache. Sibling to
 * `products_sourced_content` — same shape, different vertical.
 *
 * One row per sourced cruise × locale × market. Stores the rich
 * detail-page content the upstream adapter served via `getContent`,
 * plus the SWR metadata the read service needs.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export type CruisesSourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

export const CRUISES_CONTENT_MARKET_ANY = "*"

export const cruisesSourcedContentTable = pgTable(
  "cruises_sourced_content",
  {
    /** TypeID matching the cruises module — `crus_*`. */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag. */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(CRUISES_CONTENT_MARKET_ANY),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    content_schema_version: text("content_schema_version").notNull(),

    returned_locale: text("returned_locale").notNull(),
    machine_translated: boolean("machine_translated").notNull().default(false),

    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    etag: text("etag"),

    fetch_status: text("fetch_status")
      .$type<CruisesSourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    index("cruises_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    index("cruises_sourced_content_returned_locale_idx").on(table.entity_id, table.returned_locale),
    index("cruises_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertCruisesSourcedContent = typeof cruisesSourcedContentTable.$inferInsert
export type SelectCruisesSourcedContent = typeof cruisesSourcedContentTable.$inferSelect
