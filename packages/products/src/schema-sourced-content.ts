/**
 * Products sourced-content cache.
 *
 * One row per sourced product × locale × market. Stores the rich
 * detail-page content the upstream adapter served via `getContent`, plus
 * the SWR metadata the read service needs (TTL, ETag, fetch status,
 * locale fallback bookkeeping).
 *
 * Locale-keyed (per-locale rows, not one JSONB-of-locales) so
 * per-locale TTLs, per-locale fetch failures, "what's missing in ro-RO?"
 * SQL queries, and per-locale invalidation on drift all stay simple.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2.
 */

import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Lifecycle status per cache row. Distinct from sourced-entry lifecycle
 * (which tracks whether the upstream still advertises the entity);
 * `fetch_status` tracks the last cache fetch attempt for one
 * (entity, locale, market) tuple.
 */
export type ProductsSourcedContentFetchStatus = "ok" | "stale" | "error" | "unsupported"

/**
 * Sentinel value for the `market` column when an adapter is not
 * market-sensitive. The value `'*'` is the all-markets row; other
 * values are specific markets the adapter served content for.
 */
export const PRODUCTS_CONTENT_MARKET_ANY = "*"

export const productsSourcedContentTable = pgTable(
  "products_sourced_content",
  {
    /** TypeID matching the products module — `prod_*`. */
    entity_id: text("entity_id").notNull(),
    /** BCP 47 language tag (e.g. "ro-RO", "en-GB"). */
    locale: text("locale").notNull(),
    /** Market id, or `'*'` for all-markets. */
    market: text("market").notNull().default(PRODUCTS_CONTENT_MARKET_ANY),

    /**
     * Vertical-shaped content payload. Schema-validated against the
     * vertical's Zod validator before write; consumers must validate on
     * read against the recorded `content_schema_version`.
     */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Vertical-managed schema version (e.g. "products/v1"). */
    content_schema_version: text("content_schema_version").notNull(),

    /**
     * The locale the upstream actually served. May differ from
     * `locale` (the request locale) when the upstream did its own
     * fallback. Lets the read path mark `match_kind` accurately even
     * when serving a stale row that originated from upstream-fallback.
     */
    returned_locale: text("returned_locale").notNull(),
    /** True when the upstream marks the payload as machine-translated. */
    machine_translated: boolean("machine_translated").notNull().default(false),

    /** When the upstream itself last modified this content. */
    source_updated_at: timestamp("source_updated_at", { withTimezone: true }),
    /** When this cache row was last written. */
    fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the cache considers this row fresh until — SWR boundary. */
    fresh_until: timestamp("fresh_until", { withTimezone: true }),
    /** ETag-style marker for HTTP-cache revalidation on the next pull. */
    etag: text("etag"),

    /** Last fetch outcome. */
    fetch_status: text("fetch_status")
      .$type<ProductsSourcedContentFetchStatus>()
      .notNull()
      .default("ok"),
    /** Error detail when fetch_status === "error". */
    fetch_error: text("fetch_error"),
  },
  (table) => [
    primaryKey({ columns: [table.entity_id, table.locale, table.market] }),
    // "What's stale in ro-RO?"
    index("products_sourced_content_locale_fresh_idx").on(table.locale, table.fresh_until),
    // Fallback diagnostics: "what locales did upstream serve for prod_X?"
    index("products_sourced_content_returned_locale_idx").on(
      table.entity_id,
      table.returned_locale,
    ),
    // Cache flushes on schema bumps: DELETE WHERE schema_version != current.
    index("products_sourced_content_schema_version_idx").on(table.content_schema_version),
  ],
)

export type InsertProductsSourcedContent = typeof productsSourcedContentTable.$inferInsert
export type SelectProductsSourcedContent = typeof productsSourcedContentTable.$inferSelect
