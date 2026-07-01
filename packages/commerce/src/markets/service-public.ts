import { and, asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { marketCurrencies, marketLocales, markets } from "./schema.js"

/**
 * Customer-facing market discovery projection. Deliberately a NARROW subset of
 * the admin market row: it carries only what an anonymous storefront needs to
 * resolve and select a scope (which market, which locales, which currencies).
 *
 * Intentionally OMITTED from the public surface (admin/tenant-internal):
 * `status`, `timezone`, `taxContext`, `metadata`, timestamps, and every
 * finance/pricing internal — FX rate sets, exchange rates, price catalogs,
 * product/channel rules, and the per-currency `isSettlement` / `isReporting`
 * flags.
 *
 * The market `id` IS exposed: it is the scope key the catalog search API
 * consumes as the `market` parameter. The catalog runtime indexes and searches
 * slices keyed by `market.id` (see `loadCatalogSlices` in the operator catalog
 * runtime and `packages/catalog/src/search/routes.ts`), so a storefront that
 * discovers a non-default market here must send its `id` — not its human-facing
 * `code` — to hit the right Typesense collection. `code`/`name` are for display.
 */
export interface PublicMarketLocale {
  languageTag: string
  isDefault: boolean
}

export interface PublicMarketCurrency {
  currencyCode: string
  isDefault: boolean
}

export interface PublicMarket {
  /**
   * Catalog-search scope key — thread this into catalog search as the `market`
   * parameter. It is the market's stable identifier (`markets.id`), which the
   * catalog runtime uses to key indexed/searchable slices.
   */
  id: string
  /** Human-facing market code (e.g. `RO`, `UK`) — for display, not for search. */
  code: string
  name: string
  regionCode: string | null
  countryCode: string | null
  defaultLocale: string
  defaultCurrency: string
  locales: PublicMarketLocale[]
  currencies: PublicMarketCurrency[]
}

/**
 * Lists the supported markets for anonymous discovery. Only `active` markets are
 * returned (markets have no top-level public/private flag; per-market public
 * gating, if ever needed, is a follow-up — see routes-public.ts), each with its
 * ACTIVE locales and ACTIVE currencies, ordered by the operator's configured
 * `sortOrder`.
 */
export async function listPublicMarkets(db: PostgresJsDatabase): Promise<PublicMarket[]> {
  const marketRows = await db
    .select({
      id: markets.id,
      code: markets.code,
      name: markets.name,
      regionCode: markets.regionCode,
      countryCode: markets.countryCode,
      defaultLanguageTag: markets.defaultLanguageTag,
      defaultCurrency: markets.defaultCurrency,
    })
    .from(markets)
    .where(eq(markets.status, "active"))
    .orderBy(asc(markets.name))

  if (marketRows.length === 0) return []

  const marketIds = marketRows.map((row) => row.id)

  const [localeRows, currencyRows] = await Promise.all([
    db
      .select({
        marketId: marketLocales.marketId,
        languageTag: marketLocales.languageTag,
        isDefault: marketLocales.isDefault,
      })
      .from(marketLocales)
      .where(and(inArray(marketLocales.marketId, marketIds), eq(marketLocales.active, true)))
      .orderBy(asc(marketLocales.sortOrder), asc(marketLocales.createdAt)),
    db
      .select({
        marketId: marketCurrencies.marketId,
        currencyCode: marketCurrencies.currencyCode,
        isDefault: marketCurrencies.isDefault,
      })
      .from(marketCurrencies)
      .where(and(inArray(marketCurrencies.marketId, marketIds), eq(marketCurrencies.active, true)))
      .orderBy(asc(marketCurrencies.sortOrder), asc(marketCurrencies.createdAt)),
  ])

  const localesByMarket = new Map<string, PublicMarketLocale[]>()
  for (const row of localeRows) {
    const list = localesByMarket.get(row.marketId) ?? []
    list.push({ languageTag: row.languageTag, isDefault: row.isDefault })
    localesByMarket.set(row.marketId, list)
  }

  const currenciesByMarket = new Map<string, PublicMarketCurrency[]>()
  for (const row of currencyRows) {
    const list = currenciesByMarket.get(row.marketId) ?? []
    list.push({ currencyCode: row.currencyCode, isDefault: row.isDefault })
    currenciesByMarket.set(row.marketId, list)
  }

  return marketRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    regionCode: row.regionCode,
    countryCode: row.countryCode,
    defaultLocale: row.defaultLanguageTag,
    defaultCurrency: row.defaultCurrency,
    locales: localesByMarket.get(row.id) ?? [],
    currencies: currenciesByMarket.get(row.id) ?? [],
  }))
}
