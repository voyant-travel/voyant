/**
 * Projection extension that aggregates a "price from" amount across the
 * product's configured default-rule prices and contributes
 * `priceFromAmountCents`, `priceFromCurrency`, and `hasPricing` to the
 * product search document.
 *
 * Lives in `@voyantjs/pricing` because:
 *   - The data lives here (`option_price_rules`, `option_unit_price_rules`,
 *     `price_catalogs`).
 *   - `pricing` already depends on `products`; importing the
 *     `ProductProjectionExtension` contract type from products is the
 *     same direction. The reverse would create a circular dep.
 *
 * Wire via `createProductDocumentBuilder({ extensions: [pricingExtension] })`
 * after composing `productPricingCatalogPolicy` into the registry.
 *
 * Scope intentionally narrow:
 *   - **No schedule-aware rule resolution.** Only `is_default = true`
 *     rules contribute. Seasonal / promo rules with schedules don't
 *     surface here — they'd require per-slice resolution against a
 *     moving "now" date and are deferred to a follow-up.
 *   - **No per-departure overrides.** Same reason.
 *   - **Currency consistency.** Only rules whose catalog currency matches
 *     the product's `sellCurrency` (or whose catalog currency is null
 *     and therefore inherits the product's) are MIN'd together. This
 *     prevents emitting a misleading "from $50" when one of the rules
 *     is actually €50.
 *
 * Document churn: this projection is `now()`-independent — it reads
 * static configured prices, not date-dependent rule windows. Same
 * product reindexed an hour later produces the same fields.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import type {
  IndexerSlice,
  ProductProjectionExtension,
} from "@voyantjs/products/service-catalog-plane"
import { and, eq, isNull, or, sql } from "drizzle-orm"

import { priceCatalogs } from "./schema-catalogs.js"
import { optionPriceRules, optionUnitPriceRules } from "./schema-option-rules.js"

interface PricingProjectionOptions {
  /**
   * Resolve the product's `sellAmountCents` + `sellCurrency` so the
   * projection can MIN the product-row default into the candidate set
   * and filter rules by matching currency. Templates inject this — the
   * default reads the products table via raw SQL, but tests can stub
   * with a known shape without standing up the products schema.
   *
   * Returns `null` for both fields when the product doesn't exist.
   */
  loadProductPricing?: (
    db: AnyDrizzleDb,
    productId: string,
  ) => Promise<{ sellAmountCents: number | null; sellCurrency: string | null }>
}

interface PricingAggregate {
  priceFromAmountCents: number | null
  priceFromCurrency: string | null
  hasPricing: boolean
}

const EMPTY_AGGREGATE: PricingAggregate = {
  priceFromAmountCents: null,
  priceFromCurrency: null,
  hasPricing: false,
}

/**
 * Pure aggregation kernel — given the product-row pricing and the rule
 * candidate set, produce the projection fields. Exposed via `__test__`
 * for unit coverage that doesn't need a real DB.
 *
 * `productPrice` is the row's `sellAmountCents` (`null` when unset).
 * `currency` is the row's `sellCurrency` (used as the projected
 * currency; rule prices fed in here are pre-filtered to match).
 * `ruleCandidates` is every active default rule's `baseSellAmountCents`
 * AND every active default rule's per-unit `sellAmountCents`, with
 * nulls already filtered out.
 */
function aggregatePricing(
  productPrice: number | null,
  currency: string | null,
  ruleCandidates: ReadonlyArray<number>,
): PricingAggregate {
  const candidates: number[] = []
  if (productPrice !== null) candidates.push(productPrice)
  for (const c of ruleCandidates) candidates.push(c)

  if (candidates.length === 0) {
    return { ...EMPTY_AGGREGATE, priceFromCurrency: currency }
  }

  // MIN with a sentinel; faster than spread+Math.min for large arrays
  // and avoids the Math.min stack-arg limit edge case.
  let min = candidates[0] as number
  for (const c of candidates) {
    if (c < min) min = c
  }

  return {
    priceFromAmountCents: min,
    priceFromCurrency: currency,
    hasPricing: true,
  }
}

/**
 * Construct the pricing projection extension.
 *
 * Pass `loadProductPricing` in tests to stub the products-row fetch;
 * production uses the default raw-SQL implementation.
 */
export function createProductPricingProjectionExtension(
  options: PricingProjectionOptions = {},
): ProductProjectionExtension {
  const loadProductPricing = options.loadProductPricing ?? defaultLoadProductPricing

  return {
    name: "products:pricing",
    async project(db, productId, _slice: IndexerSlice) {
      const product = await loadProductPricing(db, productId)
      const currency = product.sellCurrency

      // Without a product row currency we can't safely filter rules by
      // matching currency — emit only the (null) row pricing. This case
      // is rare in practice (every product has sellCurrency set in the
      // operator UI) but keeps the projection failure-isolated.
      if (!currency) {
        const out = aggregatePricing(product.sellAmountCents, null, [])
        return toProjectionMap(out)
      }

      const [flatPrices, unitPrices] = await Promise.all([
        fetchFlatRulePrices(db, productId, currency),
        fetchUnitRulePrices(db, productId, currency),
      ])

      const candidates = [...flatPrices, ...unitPrices]
      const out = aggregatePricing(product.sellAmountCents, currency, candidates)
      return toProjectionMap(out)
    },
  }
}

/**
 * Read `optionPriceRules.baseSellAmountCents` for the product's active
 * default rules whose catalog currency matches the product currency
 * (or whose catalog has a NULL currency, meaning "inherit product").
 *
 * Filtering on the `(productId, active=true, isDefault=true)` subset
 * keeps the candidate set small even for products with hundreds of
 * seasonal rules.
 */
async function fetchFlatRulePrices(
  db: AnyDrizzleDb,
  productId: string,
  productCurrency: string,
): Promise<number[]> {
  const rows = await db
    .select({ price: optionPriceRules.baseSellAmountCents })
    .from(optionPriceRules)
    .innerJoin(priceCatalogs, eq(priceCatalogs.id, optionPriceRules.priceCatalogId))
    .where(
      and(
        eq(optionPriceRules.productId, productId),
        eq(optionPriceRules.active, true),
        eq(optionPriceRules.isDefault, true),
        eq(priceCatalogs.active, true),
        or(eq(priceCatalogs.currencyCode, productCurrency), isNull(priceCatalogs.currencyCode)),
      ),
    )

  const out: number[] = []
  for (const row of rows) {
    if (row.price !== null) out.push(row.price)
  }
  return out
}

/**
 * Read `optionUnitPriceRules.sellAmountCents` for active per-unit tiers
 * whose parent rule is one of the product's active default rules in a
 * matching-currency catalog. Used for products priced per occupancy
 * (e.g. cabins at "single $X / double $Y / triple $Z") where the parent
 * rule's `baseSellAmountCents` is null and the actual prices live on
 * the unit tiers.
 */
async function fetchUnitRulePrices(
  db: AnyDrizzleDb,
  productId: string,
  productCurrency: string,
): Promise<number[]> {
  const rows = await db
    .select({ price: optionUnitPriceRules.sellAmountCents })
    .from(optionUnitPriceRules)
    .innerJoin(optionPriceRules, eq(optionPriceRules.id, optionUnitPriceRules.optionPriceRuleId))
    .innerJoin(priceCatalogs, eq(priceCatalogs.id, optionPriceRules.priceCatalogId))
    .where(
      and(
        eq(optionPriceRules.productId, productId),
        eq(optionPriceRules.active, true),
        eq(optionPriceRules.isDefault, true),
        eq(optionUnitPriceRules.active, true),
        eq(priceCatalogs.active, true),
        or(eq(priceCatalogs.currencyCode, productCurrency), isNull(priceCatalogs.currencyCode)),
      ),
    )

  const out: number[] = []
  for (const row of rows) {
    if (row.price !== null) out.push(row.price)
  }
  return out
}

/**
 * Default loader reads the products row via raw SQL so we don't pull
 * the products schema into this file (would create a circular import
 * via the typed schema). The columns we read are stable enough that a
 * rename would break far more than this.
 */
async function defaultLoadProductPricing(
  db: AnyDrizzleDb,
  productId: string,
): Promise<{ sellAmountCents: number | null; sellCurrency: string | null }> {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle's typed sql is overkill for two-column read
  const dbAny = db as any
  const result = await dbAny.execute(
    sql`SELECT sell_amount_cents, sell_currency FROM products WHERE id = ${productId} LIMIT 1`,
  )
  // postgres-js returns rows as an array-like; node-postgres returns `{ rows: [...] }`.
  const rows = Array.isArray(result) ? result : (result?.rows ?? [])
  const first = rows[0] as
    | { sell_amount_cents: number | null; sell_currency: string | null }
    | undefined
  if (!first) return { sellAmountCents: null, sellCurrency: null }
  return {
    sellAmountCents: first.sell_amount_cents,
    sellCurrency: first.sell_currency,
  }
}

function toProjectionMap(a: PricingAggregate): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    ["priceFromAmountCents", a.priceFromAmountCents],
    ["priceFromCurrency", a.priceFromCurrency],
    ["hasPricing", a.hasPricing],
  ])
}

// Internal exports for unit tests — kept off the public surface.
export const __test__ = {
  aggregatePricing,
  EMPTY_AGGREGATE,
}
