/**
 * Promotion-evaluation contract types — the seam between `@voyantjs/catalog`
 * and any promotion implementation.
 *
 * Catalog defines the input/output shape so it stays decoupled from
 * `@voyantjs/promotions`: the implementation is wired in by templates as
 * an optional dependency on `QuoteEntityDeps.evaluatePromotions`.
 *
 * The shapes mirror `@voyantjs/promotions/service-evaluator`'s
 * `EvaluationResult` subset that the catalog actually consumes — the
 * promotions adapter (`createCatalogPromotionEvaluator`) just bridges the
 * two with structural compatibility.
 *
 * Per docs/architecture/promotions-architecture.md §3.6 + §7.1.1.
 */

/** Outcome of code validation when `input.code` is supplied. `null` when no code. */
export type CodeStatus =
  | null
  | { kind: "code_valid" }
  | { kind: "code_not_found" }
  | { kind: "code_expired" }
  | { kind: "code_not_yet_valid" }
  | { kind: "code_not_applicable"; reason: "scope" | "min_pax" | "currency" }

/**
 * One offer that applied to the quote. Carried on `PricingBasis.appliedOffers`
 * and persisted into `pricing_applied_offers` JSONB on `catalog_quotes` and
 * `booking_catalog_snapshot`. The post-commit redemption recorder
 * (registered as a `booking.confirmed` subscriber) reads this back.
 */
export interface AppliedOffer {
  offerId: string
  offerName: string
  /** The actual cents off attributed to this offer. */
  discountAppliedCents: number
  /** `basePriceCents - discountAppliedCents` (per-row, the price the offer alone would yield). */
  discountedPriceCents: number
  /** Matches the surrounding `PricingBasis.currency`. Carried per-row so the redemption recorder can insert without context. */
  currency: string
  discountKind: "percentage" | "fixed_amount"
  discountPercent: number | null
  discountAmountCents: number | null
  /** The literal code the customer entered (case preserved); null for auto-applied. */
  appliedCode: string | null
  stackable: boolean
}

export interface PromotionEvaluationInput {
  productId: string
  slice: {
    audience: "staff" | "customer" | "partner" | "supplier"
    market: string
  }
  pax?: number
  date?: Date
  code?: string
  basePriceCents: number
  baseCurrency: string
}

export interface PromotionEvaluationOutput {
  /** All applied offers (1+ when stacking; 0 when no offer applies). */
  applied: AppliedOffer[]
  total: {
    discountAppliedCents: number
    discountedPriceCents: number
  }
  /** Set when `input.code` was supplied. Drives the quote-level `invalidReason` mapping. */
  codeStatus: CodeStatus
}
