/**
 * Projection extension that aggregates a "price from" amount across the
 * product's future bookable rate-plan prices and contributes
 * `priceFromAmountCents`, `priceFromCurrency`, and `hasPricing` to the
 * product search document.
 *
 * Lives in `@voyantjs/commerce` because:
 *   - The data lives here (`option_price_rules`, `option_unit_price_rules`,
 *     `price_catalogs`).
 *   - Product owns the document-builder implementation, while this package
 *     exposes a structural extension that satisfies that builder contract.
 *
 * Wire via `createProductDocumentBuilder({ extensions: [pricingExtension] })`
 * after composing `productPricingCatalogPolicy` into the registry.
 *
 * Scope intentionally narrow:
 *   - **No schedule-aware rule resolution.** Only `is_default = true`
 *     rules contribute. Seasonal / promo rules with schedules don't
 *     surface here; they require per-slice rule evaluation beyond the
 *     future-departure presence check below.
 *   - **No per-departure overrides.** Same reason.
 *   - **Currency consistency.** Only rules whose catalog currency matches
 *     the product's `sellCurrency` (or whose catalog currency is null
 *     and therefore inherits the product's) are MIN'd together.
 *
 * Document churn: this projection is `now()`-dependent because it only
 * considers future bookable departures. A product can move to "unpriced"
 * once its final departure starts unless a row-level fallback remains.
 */

import type { IndexerSlice } from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { sql } from "drizzle-orm"

interface PricingProjectionOptions {
  /**
   * Resolve the product's row-level `sellAmountCents` + `sellCurrency`.
   * Templates use the default raw-SQL loader; tests can stub it without
   * standing up the products schema.
   *
   * Returns `null` for both fields when the product doesn't exist.
   */
  loadProductPricing?: (
    db: AnyDrizzleDb,
    productId: string,
  ) => Promise<{ sellAmountCents: number | null; sellCurrency: string | null }>

  /**
   * Resolve future bookable rate-plan prices for the product. Tests can
   * stub this without standing up availability/product option tables.
   */
  loadRatePlanPricing?: (
    db: AnyDrizzleDb,
    productId: string,
    productCurrency: string,
  ) => Promise<RatePlanPricing>
}

interface PricingAggregate {
  priceFromAmountCents: number | null
  priceFromCurrency: string | null
  hasPricing: boolean
}

interface RatePlanPricing {
  roomPrices: number[]
  basePrices: number[]
}

export interface ProductProjectionExtension {
  readonly name: string
  project(
    db: AnyDrizzleDb,
    productId: string,
    slice: IndexerSlice,
  ): Promise<ReadonlyMap<string, unknown>>
}

const EMPTY_AGGREGATE: PricingAggregate = {
  priceFromAmountCents: null,
  priceFromCurrency: null,
  hasPricing: false,
}

/**
 * Pure aggregation kernel. Room prices take precedence over base/unit
 * prices, which take precedence over the product-row fallback. Non-
 * positive values are treated as absent so stale `0` caches don't block
 * nullish fallbacks in catalog consumers.
 */
function aggregatePricing(
  productPrice: number | null,
  currency: string | null,
  roomPrices: ReadonlyArray<number>,
  basePrices: ReadonlyArray<number>,
): PricingAggregate {
  const min = firstPositiveMin(roomPrices) ?? firstPositiveMin(basePrices) ?? positive(productPrice)

  if (min === null) {
    return { ...EMPTY_AGGREGATE, priceFromCurrency: currency }
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
 * Pass loaders in tests to stub DB reads; production uses raw SQL against
 * the deployed schema.
 */
export function createProductPricingProjectionExtension(
  options: PricingProjectionOptions = {},
): ProductProjectionExtension {
  const loadProductPricing = options.loadProductPricing ?? defaultLoadProductPricing
  const loadRatePlanPricing = options.loadRatePlanPricing ?? defaultLoadRatePlanPricing

  return {
    name: "products:pricing",
    async project(db, productId, _slice: IndexerSlice) {
      const product = await loadProductPricing(db, productId)
      const currency = product.sellCurrency

      // Without a product row currency we can't safely filter rules by
      // matching currency. Emit only the positive row-level fallback.
      if (!currency) {
        const out = aggregatePricing(product.sellAmountCents, null, [], [])
        return toProjectionMap(out)
      }

      const ratePlans = await loadRatePlanPricing(db, productId, currency)
      const out = aggregatePricing(
        product.sellAmountCents,
        currency,
        ratePlans.roomPrices,
        ratePlans.basePrices,
      )
      return toProjectionMap(out)
    },
  }
}

/**
 * Resolve the same "from price" value emitted by the pricing projection.
 * Promotion projection wiring uses this so strikethrough base prices
 * follow the same rate-plan-first fallback chain.
 */
export async function loadProductPriceFrom(
  db: AnyDrizzleDb,
  productId: string,
): Promise<{ amountCents: number | null; currency: string | null }> {
  const product = await defaultLoadProductPricing(db, productId)
  const currency = product.sellCurrency
  if (!currency) {
    return { amountCents: positive(product.sellAmountCents), currency: null }
  }

  const ratePlans = await defaultLoadRatePlanPricing(db, productId, currency)
  const amountCents =
    firstPositiveMin(ratePlans.roomPrices) ??
    firstPositiveMin(ratePlans.basePrices) ??
    positive(product.sellAmountCents)

  return { amountCents, currency }
}

/**
 * Read positive prices from active default rules that have at least one
 * future bookable departure. Room prices are separated from base/unit
 * fallbacks so per-room pricing wins even when the product row contains
 * a stale zero or stale manual price.
 */
async function defaultLoadRatePlanPricing(
  db: AnyDrizzleDb,
  productId: string,
  productCurrency: string,
): Promise<RatePlanPricing> {
  try {
    const [roomPrice, basePrice] = await Promise.all([
      fetchBookableRoomPrice(db, productId, productCurrency),
      fetchBookableBasePrice(db, productId, productCurrency),
    ])

    return {
      roomPrices: roomPrice == null ? [] : [roomPrice],
      basePrices: basePrice == null ? [] : [basePrice],
    }
  } catch (error) {
    // Slim test fixtures may omit availability_slots/product_options/
    // option_units. Keep reindex failure-isolated and fall back to the
    // product row only for those expected schema gaps.
    if (isMissingCatalogPricingDependencyError(error)) {
      return { roomPrices: [], basePrices: [] }
    }
    throw error
  }
}

async function fetchBookableRoomPrice(
  db: AnyDrizzleDb,
  productId: string,
  productCurrency: string,
): Promise<number | null> {
  const rows = await executeRows(
    db,
    sql`
    WITH active_rules AS (
      SELECT opr.id
      FROM option_price_rules opr
      INNER JOIN price_catalogs pc ON pc.id = opr.price_catalog_id
      WHERE opr.product_id = ${productId}
        AND opr.active = true
        AND opr.is_default = true
        AND pc.active = true
        AND (pc.currency_code = ${productCurrency} OR pc.currency_code IS NULL)
        AND EXISTS (
          SELECT 1
          FROM product_options po
          WHERE po.id = opr.option_id
            AND po.product_id = opr.product_id
            AND po.status = 'active'
        )
        AND EXISTS (
          SELECT 1
          FROM availability_slots slot
          WHERE slot.product_id = opr.product_id
            AND slot.starts_at >= NOW()
            AND slot.status::text IN ('open', 'planned', 'confirmed')
            AND (slot.option_id IS NULL OR slot.option_id = opr.option_id)
        )
    ),
    candidates AS (
      SELECT
        unit_rule.sell_amount_cents AS price,
        (
          (
            category.id IS NULL
            OR category.category_type = 'adult'
            OR (
              category.category_type NOT IN ('child', 'infant', 'senior')
              AND category.min_age IS NULL
              AND category.max_age IS NULL
            )
          )
          AND COALESCE(unit_rule.min_quantity, 0) <= 1
          AND COALESCE(unit_rule.max_quantity, 0) = 0
        ) AS standard_price
      FROM active_rules rule
      INNER JOIN option_unit_price_rules unit_rule
        ON unit_rule.option_price_rule_id = rule.id
      INNER JOIN option_units unit
        ON unit.id = unit_rule.unit_id
      LEFT JOIN pricing_categories category
        ON category.id = unit_rule.pricing_category_id
      WHERE unit_rule.active = true
        AND unit.unit_type = 'room'
      UNION ALL
      SELECT
        tier.sell_amount_cents AS price,
        (
          (
            category.id IS NULL
            OR category.category_type = 'adult'
            OR (
              category.category_type NOT IN ('child', 'infant', 'senior')
              AND category.min_age IS NULL
              AND category.max_age IS NULL
            )
          )
          AND COALESCE(unit_rule.min_quantity, 0) <= 1
          AND COALESCE(unit_rule.max_quantity, 0) = 0
          AND tier.min_quantity <= 1
          AND COALESCE(tier.max_quantity, 0) = 0
        ) AS standard_price
      FROM active_rules rule
      INNER JOIN option_unit_price_rules unit_rule
        ON unit_rule.option_price_rule_id = rule.id
      INNER JOIN option_units unit
        ON unit.id = unit_rule.unit_id
      LEFT JOIN pricing_categories category
        ON category.id = unit_rule.pricing_category_id
      INNER JOIN option_unit_tiers tier
        ON tier.option_unit_price_rule_id = unit_rule.id
       AND tier.active = true
      WHERE unit_rule.active = true
        AND unit.unit_type = 'room'
    )
    SELECT COALESCE(
      MIN(price) FILTER (WHERE standard_price),
      MIN(price) FILTER (WHERE NOT standard_price)
    )::int AS price
    FROM candidates
    WHERE price > 0
  `,
  )

  return readNullableInt(rows[0], "price")
}

async function fetchBookableBasePrice(
  db: AnyDrizzleDb,
  productId: string,
  productCurrency: string,
): Promise<number | null> {
  const rows = await executeRows(
    db,
    sql`
    WITH active_rules AS (
      SELECT opr.id, opr.base_sell_amount_cents
      FROM option_price_rules opr
      INNER JOIN price_catalogs pc ON pc.id = opr.price_catalog_id
      WHERE opr.product_id = ${productId}
        AND opr.active = true
        AND opr.is_default = true
        AND pc.active = true
        AND (pc.currency_code = ${productCurrency} OR pc.currency_code IS NULL)
        AND EXISTS (
          SELECT 1
          FROM product_options po
          WHERE po.id = opr.option_id
            AND po.product_id = opr.product_id
            AND po.status = 'active'
        )
        AND EXISTS (
          SELECT 1
          FROM availability_slots slot
          WHERE slot.product_id = opr.product_id
            AND slot.starts_at >= NOW()
            AND slot.status::text IN ('open', 'planned', 'confirmed')
            AND (slot.option_id IS NULL OR slot.option_id = opr.option_id)
        )
    ),
    candidates AS (
      SELECT base_sell_amount_cents AS price, true AS standard_price
      FROM active_rules
      UNION ALL
      SELECT
        unit_rule.sell_amount_cents AS price,
        (
          (
            category.id IS NULL
            OR category.category_type = 'adult'
            OR (
              category.category_type NOT IN ('child', 'infant', 'senior')
              AND category.min_age IS NULL
              AND category.max_age IS NULL
            )
          )
          AND COALESCE(unit_rule.min_quantity, 0) <= 1
          AND COALESCE(unit_rule.max_quantity, 0) = 0
        ) AS standard_price
      FROM active_rules rule
      INNER JOIN option_unit_price_rules unit_rule
        ON unit_rule.option_price_rule_id = rule.id
      INNER JOIN option_units unit
        ON unit.id = unit_rule.unit_id
      LEFT JOIN pricing_categories category
        ON category.id = unit_rule.pricing_category_id
      WHERE unit_rule.active = true
        AND unit.unit_type <> 'room'
      UNION ALL
      SELECT
        tier.sell_amount_cents AS price,
        (
          (
            category.id IS NULL
            OR category.category_type = 'adult'
            OR (
              category.category_type NOT IN ('child', 'infant', 'senior')
              AND category.min_age IS NULL
              AND category.max_age IS NULL
            )
          )
          AND COALESCE(unit_rule.min_quantity, 0) <= 1
          AND COALESCE(unit_rule.max_quantity, 0) = 0
          AND tier.min_quantity <= 1
          AND COALESCE(tier.max_quantity, 0) = 0
        ) AS standard_price
      FROM active_rules rule
      INNER JOIN option_unit_price_rules unit_rule
        ON unit_rule.option_price_rule_id = rule.id
      INNER JOIN option_units unit
        ON unit.id = unit_rule.unit_id
      LEFT JOIN pricing_categories category
        ON category.id = unit_rule.pricing_category_id
      INNER JOIN option_unit_tiers tier
        ON tier.option_unit_price_rule_id = unit_rule.id
       AND tier.active = true
      WHERE unit_rule.active = true
        AND unit.unit_type <> 'room'
    )
    SELECT COALESCE(
      MIN(price) FILTER (WHERE standard_price),
      MIN(price) FILTER (WHERE NOT standard_price)
    )::int AS price
    FROM candidates
    WHERE price > 0
  `,
  )

  return readNullableInt(rows[0], "price")
}

async function executeRows(db: AnyDrizzleDb, query: ReturnType<typeof sql>): Promise<unknown[]> {
  // biome-ignore lint/suspicious/noExplicitAny: #1141 supports multiple drizzle driver result shapes
  const result = await (db as any).execute(query)
  return Array.isArray(result) ? result : (result?.rows ?? [])
}

/**
 * Default loader reads the products row via raw SQL so we don't pull
 * the products schema into this file. The columns we read are stable
 * enough that a rename would break far more than this.
 */
async function defaultLoadProductPricing(
  db: AnyDrizzleDb,
  productId: string,
): Promise<{ sellAmountCents: number | null; sellCurrency: string | null }> {
  // biome-ignore lint/suspicious/noExplicitAny: #1141 keeps cross-package product lookup driver-agnostic
  const dbAny = db as any
  const result = await dbAny.execute(
    // agent-quality: raw-sql reviewed -- owner: pricing; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && value > 0 ? value : null
}

function firstPositiveMin(values: ReadonlyArray<number>): number | null {
  let min: number | null = null
  for (const value of values) {
    if (value <= 0) continue
    if (min === null || value < min) min = value
  }
  return min
}

function readNullableInt(row: unknown, key: string): number | null {
  const value = (row as Record<string, unknown> | undefined)?.[key]
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isMissingCatalogPricingDependencyError(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown } | null | undefined
  const code = typeof err?.code === "string" ? err.code : null
  if (code === "42P01" || code === "42703") return true

  const message = typeof err?.message === "string" ? err.message.toLowerCase() : ""
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("no such table") ||
    message.includes("no such column")
  )
}

function toProjectionMap(a: PricingAggregate): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    ["priceFromAmountCents", a.priceFromAmountCents],
    ["priceFromCurrency", a.priceFromCurrency],
    ["hasPricing", a.hasPricing],
  ])
}

// Internal exports for unit tests - kept off the public surface.
export const __test__ = {
  aggregatePricing,
  EMPTY_AGGREGATE,
  firstPositiveMin,
  isMissingCatalogPricingDependencyError,
}
