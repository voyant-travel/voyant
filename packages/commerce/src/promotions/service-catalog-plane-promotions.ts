/**
 * Projection extension that decorates the product search document with
 * promotional-offer annotations declared by the Product catalog policy.
 *
 * Lives in `@voyant-travel/commerce` because:
 *   - The data lives here.
 *   - Product owns the document-builder implementation, while this package
 *     exposes a structural extension that satisfies that builder contract.
 *
 * Wire via `createProductDocumentBuilder({ extensions: [...promotionsExt] })`
 * after composing `productPromotionsCatalogPolicy` into the registry.
 *
 * Annotation-only contract (per §3.7 of the architecture doc): this
 * extension does NOT touch `priceFromAmountCents` (that's emitted by the
 * pricing extension and the two extensions can't read each other's
 * output). It only emits `bestOffer*` + `originalPriceFromAmountCents` +
 * `conditionalOffer*`. Storefront consumers compute the effective price
 * client-side.
 *
 * `originalPriceFromAmountCents` resolution: by default we read
 * `products.sell_amount_cents` directly (works for simple products with
 * row-level pricing). Operators with option-driven pricing should pass
 * `loadOriginalPrice` to wire the same rate-plan-first resolver the
 * pricing extension uses; otherwise the strikethrough may not match the
 * customer-visible list price for option-driven products.
 *
 * Per docs/architecture/commerce-architecture.md §6.
 */

import type { IndexerSlice } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  type AppliedOffer,
  type ConditionalOffer,
  createDrizzleOfferDataSource,
  type EvaluationResult,
  evaluateOffersForProduct,
} from "./service-evaluator.js"

export interface PromotionsProjectionOptions {
  /**
   * Resolve the un-discounted "from price" + currency for a product.
   * The result drives `originalPriceFromAmountCents` + the evaluator's
   * `basePriceCents` / `baseCurrency` inputs.
   *
   * Defaults to a direct read of `products.sell_amount_cents` +
   * `products.sell_currency` — works for simple row-priced products.
   * Operators with option-driven pricing should wire this to the same
   * rate-plan-first resolver the pricing extension uses.
   *
   * Returns `null` for amountCents when the product has no configured
   * base price (the extension then short-circuits to an empty projection
   * since there's no base for the evaluator to discount).
   */
  loadOriginalPrice?: (
    db: AnyDrizzleDb,
    productId: string,
  ) => Promise<{ amountCents: number | null; currency: string | null }>

  /** Override `now()` for testing. Defaults to wall-clock time at projection. */
  now?: () => Date
}

export interface ProductProjectionExtension {
  readonly name: string
  project(
    db: AnyDrizzleDb,
    productId: string,
    slice: IndexerSlice,
  ): Promise<ReadonlyMap<string, unknown>>
}

/**
 * Map an `IndexerSlice.audience` (which can include `staff-admin`) onto the
 * evaluator's narrower `Visibility` enum. Both `staff` and `staff-admin`
 * map to `staff` for offer-evaluation purposes — both are operator-internal
 * surfaces that should see the same promotional inventory.
 */
function sliceAudience(slice: IndexerSlice): "staff" | "customer" | "partner" | "supplier" {
  if (slice.audience === "staff-admin") return "staff"
  return slice.audience
}

const EMPTY_PROJECTION: ReadonlyMap<string, unknown> = toProjectionMap(null, null, null)

export function createProductPromotionsProjectionExtension(
  options: PromotionsProjectionOptions = {},
): ProductProjectionExtension {
  const loadOriginalPrice = options.loadOriginalPrice ?? defaultLoadOriginalPrice
  const nowFn = options.now ?? (() => new Date())

  return {
    name: "promotions:offers",
    async project(db, productId, slice) {
      const { amountCents, currency } = await loadOriginalPrice(db, productId)
      if (amountCents == null || currency == null) {
        // No base price configured → no offer math to do. Returning the
        // empty projection ensures consumers see explicit nulls instead
        // of stale prior values from the doc.
        return EMPTY_PROJECTION
      }

      const source = createDrizzleOfferDataSource(db)
      const evaluation = await evaluateOffersForProduct(source, {
        productId,
        slice: { audience: sliceAudience(slice), market: slice.market },
        date: nowFn(),
        basePriceCents: amountCents,
        baseCurrency: currency,
        // pax + code intentionally omitted: catalog plane never knows
        // these. minPax-conditioned offers land in `result.conditional`.
      })

      const conditional =
        evaluation.conditional.find((offer) => offer.unmet.kind === "min_pax") ?? null
      // Surface `originalPriceFromAmountCents` ONLY when an offer applies —
      // §3.7 keeps the doc lean by leaving it null otherwise.
      const original = evaluation.best != null ? amountCents : null
      return toProjectionMap(evaluation.best, conditional, original)
    },
  }
}

function toProjectionMap(
  best: AppliedOffer | null,
  conditional: ConditionalOffer | null,
  originalPrice: number | null,
): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    ["hasOffer", best != null],
    ["bestOfferId", best?.offerId ?? null],
    ["bestOfferName", best?.offerName ?? null],
    ["bestOfferDiscountKind", best?.discountKind ?? null],
    ["bestOfferDiscountPercent", best?.discountPercent ?? null],
    ["bestOfferDiscountAmountCents", best?.discountAmountCents ?? null],
    ["originalPriceFromAmountCents", originalPrice],

    ["hasConditionalOffer", conditional != null],
    ["conditionalOfferId", conditional?.offerId ?? null],
    ["conditionalOfferName", conditional?.offerName ?? null],
    ["conditionalOfferDiscountKind", conditional?.discountKind ?? null],
    ["conditionalOfferDiscountPercent", conditional?.discountPercent ?? null],
    ["conditionalOfferDiscountAmountCents", conditional?.discountAmountCents ?? null],
    [
      "conditionalOfferMinPax",
      conditional != null && conditional.unmet.kind === "min_pax"
        ? conditional.unmet.required
        : null,
    ],
  ])
}

/**
 * Default loader — single-column read against `products` so we don't pull
 * the products schema into this file (would deepen the coupling). The
 * column shape is stable enough that string-keyed access is safe; a
 * schema rename would break far more than this projection.
 */
async function defaultLoadOriginalPrice(
  db: AnyDrizzleDb,
  productId: string,
): Promise<{ amountCents: number | null; currency: string | null }> {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle's typed sql is overkill for a single-row read -- owner: promotions; existing suppression is intentional pending typed cleanup.
  const dbAny = db as any
  const { sql } = await import("drizzle-orm")
  const result = await dbAny.execute(
    // agent-quality: raw-sql reviewed -- owner: promotions; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    sql`SELECT sell_amount_cents, sell_currency FROM products WHERE id = ${productId} LIMIT 1`,
  )
  // postgres-js returns array-like; node-postgres returns `{ rows }`. Handle both.
  const rows = Array.isArray(result) ? result : (result?.rows ?? [])
  const first = rows[0] as
    | { sell_amount_cents?: number | null; sell_currency?: string | null }
    | undefined
  return {
    amountCents: first?.sell_amount_cents ?? null,
    currency: first?.sell_currency ?? null,
  }
}

// Internal exports for unit tests — kept off the public surface.
export const __test__ = { toProjectionMap, EMPTY_PROJECTION, sliceAudience }

export type { EvaluationResult }
