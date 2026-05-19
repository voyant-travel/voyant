/**
 * Accommodation sourced-content cache. Sibling to
 * `products_sourced_content` and `cruises_sourced_content` — same
 * shape, different vertical.
 *
 * One row per sourced room-type × locale × market. Stores the rich
 * detail-page content the upstream adapter served via `getContent`,
 * plus the SWR metadata the read service needs.
 *
 * The accommodation vertical's catalog entry is the **room type** (the
 * sellable variant within a property). Sourced room types — bedbank
 * inventory like Hotelbeds / Expedia — store the property summary,
 * room types, rate plans, meal plans, and amenities all in one
 * payload via `getContent`.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export type AccommodationSourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

export const ACCOMMODATION_CONTENT_MARKET_ANY = "*"

export const accommodationSourcedContentTable = pgTable(
  "accommodations_sourced_content",
  {
    /**
     * TypeID for the sourced room option/catalog entry. Existing room option
     * rows use the room_types TypeID family.
     */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag. */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(ACCOMMODATION_CONTENT_MARKET_ANY),

    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    content_schema_version: text("content_schema_version").notNull(),

    returned_locale: text("returned_locale").notNull(),
    machine_translated: boolean("machine_translated").notNull().default(false),

    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    etag: text("etag"),

    fetch_status: text("fetch_status")
      .$type<AccommodationSourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    index("accommodations_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    index("accommodations_sourced_content_returned_locale_idx").on(
      table.entity_id,
      table.returned_locale,
    ),
    index("accommodations_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertAccommodationSourcedContent = typeof accommodationSourcedContentTable.$inferInsert
export type SelectAccommodationSourcedContent = typeof accommodationSourcedContentTable.$inferSelect
