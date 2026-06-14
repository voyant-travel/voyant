/**
 * Promotions rule evaluator — the heart of §5.
 *
 * One pure function (`evaluateOffersForProduct`) used by both callers
 * (catalog plane projection in PR3 + checkout quote in PR4). The evaluator
 * doesn't bind to a database — it takes an `OfferDataSource` interface so
 * the catalog projection can reuse one cached candidate set across many
 * products in a slice, and unit tests can supply in-memory fixtures
 * without a DB mock.
 *
 * The DB-backed `OfferDataSource` factory (`createDrizzleOfferDataSource`)
 * is provided too — that's what PR3/PR4 wire up.
 *
 * Per docs/architecture/promotions-architecture.md §5.
 *
 * Not yet exported from the package barrel — PR3 wires it via the catalog
 * plane adapter, PR4 via the checkout adapter.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm"

import { type PromotionalOffer, promotionalOfferProducts, promotionalOffers } from "./schema.js"
import type { PromotionalOfferConditions, PromotionalOfferScope } from "./validation.js"

// ---------- Public types ----------

export interface OfferEvaluationContext {
  productId: string
  slice: {
    audience: "staff" | "customer" | "partner" | "supplier"
    market: string
  }
  /** Optional booking-line fare code, used by fare-scoped offers. */
  fareCode?: string | null
  /** Optional cabin grade code, used by cruise cabin-grade-scoped offers. */
  cabinGradeCode?: string | null
  eligibility?: {
    pastGuest?: boolean
    soloTraveler?: boolean
    hasChildTraveler?: boolean
    family?: boolean
  }
  /** Total travelers. Absent at catalog-index time; supplied at checkout. */
  pax?: number
  /** Defaults to `now()` when undefined. */
  date?: Date
  /** Customer-typed promotion code; case-insensitive match. */
  code?: string
  basePriceCents: number
  baseCurrency: string
}

export interface AppliedOffer {
  offerId: string
  offerName: string
  /** The actual cents off attributed to this offer. */
  discountAppliedCents: number
  /** `basePriceCents - discountAppliedCents` (per-row, the price the offer alone would yield). */
  discountedPriceCents: number
  /** Matches the surrounding `ctx.baseCurrency` — carried per-row so the redemption recorder can insert without context. */
  currency: string
  discountKind: "percentage" | "fixed_amount"
  discountPercent: number | null
  discountAmountCents: number | null
  /** The literal code the customer entered (case preserved); null for auto-applied. */
  appliedCode: string | null
  stackable: boolean
}

/**
 * An offer that *would* apply if a missing input were supplied — typically
 * a `minPax` condition the catalog-plane caller can't satisfy because pax
 * isn't known at index time. Surfaced for storefront UI hints like
 * "From 4 pax: extra 5% off".
 */
export interface ConditionalOffer {
  offerId: string
  offerName: string
  discountKind: "percentage" | "fixed_amount"
  discountPercent: number | null
  discountAmountCents: number | null
  unmet:
    | { kind: "min_pax"; required: number }
    | { kind: "past_guest" }
    | { kind: "solo_traveler" }
    | { kind: "child_traveler" }
    | { kind: "family" }
}

/** Outcome of code validation when `ctx.code` is supplied. `null` when ctx.code was not set. */
export type CodeStatus =
  | null
  | { kind: "code_valid" }
  | { kind: "code_not_found" }
  | { kind: "code_expired" }
  | { kind: "code_not_yet_valid" }
  | { kind: "code_not_applicable"; reason: "scope" | "min_pax" | "eligibility" | "currency" }

export interface EvaluationResult {
  /** All applied offers (1+ when stacking; 0 when no offer applies). May include a code-gated offer alongside auto offers. */
  applied: AppliedOffer[]
  /** The single best offer (largest discount among the applied set), or null if none. Always references one row in `applied`. */
  best: AppliedOffer | null
  /** Conditionally applicable — a missing input would make them apply. Only populated by the catalog-plane caller (no `ctx.pax`). Empty for checkout. */
  conditional: ConditionalOffer[]
  total: {
    discountAppliedCents: number
    discountedPriceCents: number
  }
  /** Set when `ctx.code` was supplied. Drives the checkout caller's `invalidReason` mapping (§7.2). */
  codeStatus: CodeStatus
}

/**
 * Read-only data access the evaluator needs. Decoupled from drizzle so
 * unit tests can supply in-memory fixtures and so the catalog projection
 * can cache `fetchActiveAutoCandidates` once per slice.
 */
export interface OfferDataSource {
  /** All active offers whose validity window includes `date` AND `code IS NULL`. */
  fetchActiveAutoCandidates(date: Date): Promise<PromotionalOffer[]>

  /** Active offer matching `lower(code) = lower(input)`, or null. */
  findActiveOfferByCode(code: string): Promise<PromotionalOffer | null>

  /** Subset of `offerIds` whose `promotional_offer_products` table has a row for `productId`. */
  productMatchesAnyScope(productId: string, offerIds: string[]): Promise<Set<string>>
}

// ---------- DB-backed source factory (used by PR3 + PR4) ----------

export function createDrizzleOfferDataSource(db: AnyDrizzleDb): OfferDataSource {
  return {
    async fetchActiveAutoCandidates(date) {
      return db.select().from(promotionalOffers).where(activeAutoOfferPredicate(date))
    },

    async findActiveOfferByCode(code) {
      const rows = await db
        .select()
        .from(promotionalOffers)
        .where(
          and(
            eq(promotionalOffers.active, true),
            // agent-quality: raw-sql reviewed -- owner: promotions; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`lower(${promotionalOffers.code}) = ${code.toLowerCase()}`,
          ),
        )
        .limit(1)
      return rows[0] ?? null
    },

    async productMatchesAnyScope(productId, offerIds) {
      if (offerIds.length === 0) return new Set()
      const rows = await db
        .select({ offerId: promotionalOfferProducts.offerId })
        .from(promotionalOfferProducts)
        .where(
          and(
            eq(promotionalOfferProducts.productId, productId),
            inArray(promotionalOfferProducts.offerId, offerIds),
          ),
        )
      return new Set(rows.map((r) => r.offerId))
    },
  }
}

function activeAutoOfferPredicate(date: Date) {
  return and(
    eq(promotionalOffers.active, true),
    isNull(promotionalOffers.code),
    or(isNull(promotionalOffers.validFrom), lte(promotionalOffers.validFrom, date)),
    or(isNull(promotionalOffers.validUntil), gte(promotionalOffers.validUntil, date)),
  )
}

// ---------- Internal helpers ----------

function discountKind(offer: PromotionalOffer): "percentage" | "fixed_amount" {
  return offer.discountType
}

function discountFields(offer: PromotionalOffer): {
  discountKind: "percentage" | "fixed_amount"
  discountPercent: number | null
  discountAmountCents: number | null
} {
  return {
    discountKind: discountKind(offer),
    discountPercent: offer.discountPercent != null ? Number(offer.discountPercent) : null,
    discountAmountCents: offer.discountAmountCents,
  }
}

/**
 * Cents off a given base for a single offer. Caps fixed_amount at the
 * available base so a discount can never exceed the price.
 */
function computeDiscount(offer: PromotionalOffer, basePriceCents: number): number {
  if (basePriceCents <= 0) return 0
  if (offer.discountType === "percentage") {
    if (offer.discountPercent == null) return 0
    const pct = Number(offer.discountPercent)
    return Math.round((basePriceCents * pct) / 100)
  }
  if (offer.discountAmountCents == null) return 0
  return Math.min(offer.discountAmountCents, basePriceCents)
}

function matchesScope(
  scope: PromotionalOfferScope,
  ctx: OfferEvaluationContext,
  offerMatchesProduct: boolean,
): boolean {
  switch (scope.kind) {
    case "global":
      return true
    case "products":
    case "categories":
    case "destinations":
      return offerMatchesProduct
    case "markets":
      return scope.marketIds.includes(ctx.slice.market)
    case "audiences":
      return scope.audiences.includes(ctx.slice.audience)
    case "fare_codes":
      return ctx.fareCode != null && scope.fareCodes.includes(ctx.fareCode)
    case "cabin_grades":
      return ctx.cabinGradeCode != null && scope.cabinGradeCodes.includes(ctx.cabinGradeCode)
  }
}

type ConditionsResult =
  | { kind: "ok" }
  | { kind: "conditional"; unmet: ConditionalOffer["unmet"] }
  | { kind: "excluded"; reason: "min_pax" | "eligibility" }

function evaluateConditions(
  conditions: PromotionalOfferConditions,
  ctx: OfferEvaluationContext,
): ConditionsResult {
  if (conditions.minPax != null) {
    if (ctx.pax === undefined) {
      return { kind: "conditional", unmet: { kind: "min_pax", required: conditions.minPax } }
    }
    if (ctx.pax < conditions.minPax) {
      return { kind: "excluded", reason: "min_pax" }
    }
  }
  if (conditions.pastGuestOnly === true) {
    const result = evaluateEligibilityFlag(ctx.eligibility?.pastGuest, { kind: "past_guest" })
    if (result.kind !== "ok") return result
  }
  if (conditions.soloTravelerOnly === true) {
    const soloTraveler =
      ctx.eligibility?.soloTraveler ?? (ctx.pax != null ? ctx.pax === 1 : undefined)
    const result = evaluateEligibilityFlag(soloTraveler, { kind: "solo_traveler" })
    if (result.kind !== "ok") return result
  }
  if (conditions.childTravelerOnly === true) {
    const result = evaluateEligibilityFlag(ctx.eligibility?.hasChildTraveler, {
      kind: "child_traveler",
    })
    if (result.kind !== "ok") return result
  }
  if (conditions.familyOnly === true) {
    const result = evaluateEligibilityFlag(ctx.eligibility?.family, { kind: "family" })
    if (result.kind !== "ok") return result
  }
  return { kind: "ok" }
}

function evaluateEligibilityFlag(
  value: boolean | undefined,
  unmet: ConditionalOffer["unmet"],
): ConditionsResult {
  if (value === true) return { kind: "ok" }
  if (value === false) return { kind: "excluded", reason: "eligibility" }
  return { kind: "conditional", unmet }
}

function currencyMatches(offer: PromotionalOffer, ctx: OfferEvaluationContext): boolean {
  if (offer.discountType !== "fixed_amount") return true
  return offer.currency === ctx.baseCurrency
}

interface SelectedRow {
  offer: PromotionalOffer
  appliedCents: number
}

/**
 * Stacking pick (§5.2.6 + §3.3):
 *   - Pick the single best non-stackable offer (largest cents off the base).
 *   - Separately compose all `stackable` offers sequentially (deterministic
 *     order: by offerId ascending) — each stackable offer applies to the
 *     RUNNING base after prior stackables, which produces the multiplicative
 *     formula for percentage stackables and well-defined behavior for
 *     fixed_amount or mixed-type stackables.
 *   - Take whichever path yields the larger total discount. Ties → prefer
 *     the single non-stackable (simpler customer-facing receipt).
 */
function pickStacking(
  applied: PromotionalOffer[],
  basePriceCents: number,
): { rows: SelectedRow[]; runningBase: number } {
  const stackable: PromotionalOffer[] = []
  const nonStackable: PromotionalOffer[] = []
  for (const offer of applied) {
    if (offer.stackable) stackable.push(offer)
    else nonStackable.push(offer)
  }

  // Best single non-stackable
  let bestNonStackable: PromotionalOffer | null = null
  let bestNonStackableDiscount = 0
  for (const offer of nonStackable) {
    const d = computeDiscount(offer, basePriceCents)
    if (d > bestNonStackableDiscount) {
      bestNonStackable = offer
      bestNonStackableDiscount = d
    }
  }

  // Composed stackables (sequential, sorted by offerId for determinism)
  const sortedStackable = [...stackable].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let stackableBase = basePriceCents
  const stackableRows: SelectedRow[] = []
  for (const offer of sortedStackable) {
    const d = computeDiscount(offer, stackableBase)
    if (d <= 0) continue
    stackableRows.push({ offer, appliedCents: d })
    stackableBase -= d
  }
  const stackableTotal = basePriceCents - stackableBase

  if (bestNonStackable && bestNonStackableDiscount >= stackableTotal) {
    return {
      rows: [{ offer: bestNonStackable, appliedCents: bestNonStackableDiscount }],
      runningBase: basePriceCents - bestNonStackableDiscount,
    }
  }
  return { rows: stackableRows, runningBase: stackableBase }
}

function toAppliedOffer(
  row: SelectedRow,
  ctx: OfferEvaluationContext,
  appliedCode: string | null,
): AppliedOffer {
  const fields = discountFields(row.offer)
  return {
    offerId: row.offer.id,
    offerName: row.offer.name,
    discountAppliedCents: row.appliedCents,
    discountedPriceCents: ctx.basePriceCents - row.appliedCents,
    currency: ctx.baseCurrency,
    discountKind: fields.discountKind,
    discountPercent: fields.discountPercent,
    discountAmountCents: fields.discountAmountCents,
    appliedCode: row.offer.code != null ? appliedCode : null,
    stackable: row.offer.stackable,
  }
}

// ---------- Public entry point ----------

export async function evaluateOffersForProduct(
  source: OfferDataSource,
  ctx: OfferEvaluationContext,
): Promise<EvaluationResult> {
  const date = ctx.date ?? new Date()

  // Step 1: code lookup (when supplied) — classify validity AHEAD of the
  // scope/conditions/currency filters so we can produce a precise
  // `code_expired` / `code_not_yet_valid` reason instead of conflating
  // them with `code_not_found`.
  let codeOffer: PromotionalOffer | null = null
  let preFilterCodeStatus: CodeStatus = null
  if (ctx.code !== undefined) {
    const found = await source.findActiveOfferByCode(ctx.code)
    if (found == null) {
      preFilterCodeStatus = { kind: "code_not_found" }
    } else if (found.validUntil != null && found.validUntil < date) {
      preFilterCodeStatus = { kind: "code_expired" }
    } else if (found.validFrom != null && found.validFrom > date) {
      preFilterCodeStatus = { kind: "code_not_yet_valid" }
    } else {
      codeOffer = found
      // Tentatively valid; finalize after scope/conditions/currency filters.
    }
  }

  // Step 2: auto-offer candidate fetch
  const autoCandidates = await source.fetchActiveAutoCandidates(date)
  const allCandidates = codeOffer ? [...autoCandidates, codeOffer] : autoCandidates

  // Pre-fetch product link membership in one query (§5.2.3 — uniform hot path).
  const offerIds = allCandidates.map((o) => o.id)
  const productMatchSet = await source.productMatchesAnyScope(ctx.productId, offerIds)

  // Steps 3 + 4 + 5: scope / conditions / currency filter, partition.
  const applied: PromotionalOffer[] = []
  const conditional: ConditionalOffer[] = []
  let codeOfferRejection: { kind: "scope" | "min_pax" | "eligibility" | "currency" } | null = null

  for (const offer of allCandidates) {
    if (!matchesScope(offer.scope, ctx, productMatchSet.has(offer.id))) {
      if (offer === codeOffer) codeOfferRejection = { kind: "scope" }
      continue
    }

    const cond = evaluateConditions(offer.conditions, ctx)
    if (cond.kind === "conditional") {
      conditional.push({
        offerId: offer.id,
        offerName: offer.name,
        ...discountFields(offer),
        unmet: cond.unmet,
      })
      continue
    }
    if (cond.kind === "excluded") {
      if (offer === codeOffer) codeOfferRejection = { kind: cond.reason }
      continue
    }

    if (!currencyMatches(offer, ctx)) {
      if (offer === codeOffer) codeOfferRejection = { kind: "currency" }
      continue
    }

    applied.push(offer)
  }

  // Finalize codeStatus after the filter pass.
  let codeStatus: CodeStatus = preFilterCodeStatus
  if (ctx.code !== undefined && codeStatus === null) {
    if (codeOfferRejection != null) {
      codeStatus = { kind: "code_not_applicable", reason: codeOfferRejection.kind }
    } else {
      codeStatus = { kind: "code_valid" }
    }
  }

  // Step 6 + 7: stacking pick + assemble result.
  const { rows, runningBase } = pickStacking(applied, ctx.basePriceCents)

  const appliedRows = rows.map((r) =>
    toAppliedOffer(r, ctx, r.offer === codeOffer ? (ctx.code ?? null) : null),
  )

  let best: AppliedOffer | null = null
  for (const row of appliedRows) {
    if (best == null || row.discountAppliedCents > best.discountAppliedCents) {
      best = row
    }
  }

  return {
    applied: appliedRows,
    best,
    conditional,
    total: {
      discountAppliedCents: ctx.basePriceCents - runningBase,
      discountedPriceCents: runningBase,
    },
    codeStatus,
  }
}

// Internal exports for unit tests — kept off the public surface.
export const __test__ = { activeAutoOfferPredicate }
