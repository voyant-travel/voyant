/**
 * Owned-arm booking handler for the `products` vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6 +
 * §10 Phase A. Composes:
 *
 *   - The products vertical's existing pricing primitives
 *     (`products.sellAmountCents` / `sellCurrency`) for pricing
 *     basis. Per-pax / per-band pricing layered in Phase C+ via
 *     `product_pax_pricing_tiers`.
 *   - `getProductContent` + `buildProductDraftShape` for the journey
 *     wizard's step descriptor.
 *   - An injected `createBooking` function for the commit path
 *     — keeps `@voyantjs/products` from depending on
 *     `@voyantjs/finance` (no workspace cycle).
 *
 * Phase A scope (deliberately narrow):
 *   - Price = product.sellAmountCents × pax_count, no taxes / addons /
 *     accommodation / vouchers.
 *   - Commit goes through the bridge into `bookingsCreate`'s input
 *     shape — products-only, no extras / accommodations / cruises / encrypted
 *     travel details / snapshot graph.
 *
 * Phase C+ extensions land on this same handler without re-architecting
 * the dispatch.
 */

import {
  type AddonOffer,
  type BookingDraftShape,
  type CommitOwnedRequest,
  type CommitOwnedResult,
  type ComputeQuoteRequest,
  type ComputeQuoteResult,
  DEFAULT_PAX_BANDS,
  defaultBookingFields,
  defaultDraftShapeFlags,
  defaultTravelerFields,
  type OwnedBookingHandler,
  type OwnedHandlerContext,
  paxBandsAllowedTotalFrom,
  type TravelerFieldRequirement,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { products } from "../schema-core.js"

// ─────────────────────────────────────────────────────────────────
// Bridged commit path — caller-supplied so the products package
// doesn't depend on @voyantjs/finance.
// ─────────────────────────────────────────────────────────────────

/**
 * Subset of `bookingsCreate`'s input the bridge builds.
 * Mirrors the schema in `service-booking-create.ts` — kept
 * structural here so we don't pull a dependency into products.
 */
export interface BookingCreateBridgeInput {
  productId: string
  optionId?: string | null
  slotId?: string | null
  bookingNumber: string
  personId?: string | null
  organizationId?: string | null
  internalNotes?: string | null
  /**
   * Override the seed sellAmountCents the booking lands at. The owned
   * commit passes this when the catalog booking-engine's promotion hook
   * has discounted the quote — without it, customers would be charged
   * the product's list price even with a successful promotion. Per
   * docs/architecture/promotions-architecture.md §7.1.
   */
  sellAmountCentsOverride?: number | null
  travelers?: Array<{
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    personId?: string | null
    participantType: "traveler" | "occupant" | "other"
    travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
    isPrimary?: boolean | null
  }>
  paymentSchedules?: Array<{
    scheduleType: "deposit" | "installment" | "balance" | "hold" | "other"
    status: "pending" | "due" | "paid" | "waived" | "cancelled" | "expired"
    dueDate: string
    currency: string
    amountCents: number
    notes?: string | null
  }>
  taxLines?: Array<{
    code?: string | null
    name: string
    jurisdiction?: string | null
    scope?: "included" | "excluded" | "withheld"
    currency: string
    amountCents: number
    rateBasisPoints?: number | null
    includedInPrice?: boolean
    remittanceParty?: string | null
    sortOrder?: number
  }>
}

export interface BookingCreateBridgeResult {
  status: "ok" | "product_not_found" | string
  bookingId?: string
  bookingNumber?: string
}

/**
 * Caller-supplied bridge to `bookingsCreate`. Templates wire
 * this up — `(input, opts) => createBooking(db as PostgresJsDatabase, input, opts)`.
 */
export type BookingCreateBridge = (
  input: BookingCreateBridgeInput,
  options?: { userId?: string },
) => Promise<BookingCreateBridgeResult>

// ─────────────────────────────────────────────────────────────────
// Draft shape — what the wizard reads off the quote response
// ─────────────────────────────────────────────────────────────────

interface DraftLike {
  configure?: {
    pax?: Partial<Record<string, number>>
    departureSlotId?: string
    departureDate?: string
    departureTime?: string
    variantId?: string
  }
  billing?: {
    buyerType?: "B2C" | "B2B"
    contact?: { firstName?: string; lastName?: string; email?: string; phone?: string }
    address?: { country?: string }
  }
  travelers?: Array<{
    firstName: string
    lastName: string
    email?: string
    phone?: string
    band?: string
  }>
}

export interface BuildOwnedProductDraftShapeOptions {
  /**
   * Per-traveler field requirements pulled from
   * `@voyantjs/booking-requirements` for this product. Caller-supplied
   * so the products package doesn't depend on booking-requirements.
   */
  travelerFields?: ReadonlyArray<TravelerFieldRequirement>
  /**
   * Add-on catalog projected from extras. Caller-supplied so
   * products doesn't depend on `@voyantjs/extras`. When omitted,
   * `showsAddons` is false.
   */
  addonCatalog?: ReadonlyArray<AddonOffer>
}

export function buildOwnedProductDraftShape(
  options: BuildOwnedProductDraftShapeOptions = {},
): BookingDraftShape {
  const paxBands = DEFAULT_PAX_BANDS
  const fields = options.travelerFields ?? defaultTravelerFields()
  const addons = options.addonCatalog ?? []
  const flags = defaultDraftShapeFlags()
  return {
    ...flags,
    showsAddons: addons.length > 0,
    paxBands,
    paxBandsAllowedTotal: paxBandsAllowedTotalFrom(paxBands),
    travelerFields: fields,
    bookingFields: defaultBookingFields(),
    paymentIntents: ["hold", "card"],
    configureSubSteps: [{ kind: "occupancy", bands: paxBands }],
    addons: addons.length > 0 ? { catalog: addons } : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────

/** A per-unit price within a resolved option price rule, returned by
 *  `loadResolvedOptionPrice`. The handler matches `travelerCategory`
 *  to the draft's pax-band codes ("adult" / "child" / "infant" /
 *  "senior") to compute per-band totals. Units that don't map to a
 *  band — or whose band has zero count — are dropped. */
export interface ResolvedUnitPrice {
  unitId: string
  unitType: "person" | "room" | "vehicle" | "service" | "group" | "other" | string
  travelerCategory: "adult" | "child" | "infant" | "senior" | null
  sellAmountCents: number | null
}

/** Output of `loadResolvedOptionPrice`. The handler prefers
 *  `unitPrices` (per-band pricing) when present and any unit matches a
 *  pax band; otherwise falls back to `baseSellAmountCents × paxCount`
 *  for per-booking rules; otherwise back to `product.sellAmountCents`. */
export interface ResolvedOptionPrice {
  baseSellAmountCents: number | null
  unitPrices: ReadonlyArray<ResolvedUnitPrice>
}

/** A resolved tax-rate decision — resolved from `tax_classes` ×
 *  `tax_regimes` × buyer country at quote time. */
export interface ResolvedTaxRate {
  /** Stable code (e.g. "vat-ro-19", "exempt-art311"). */
  code: string
  /** Display label for the breakdown. */
  label: string
  /** Rate as a fraction (0..1). 0 means exempt / zero-rated. */
  rate: number
  /** Whether the configured product price already includes this tax. */
  priceMode?: "inclusive" | "exclusive"
}

/** Caller-supplied loaders for descriptor enrichment. Each is
 *  optional — when omitted the handler returns the default shape.
 *  Templates wire these to the modules they have on hand
 *  (booking-requirements, extras, finance). */
export interface OwnedProductsShapeLoaders {
  /**
   * Resolve per-traveler field requirements from
   * @voyantjs/booking-requirements. Called per-quote so the descriptor
   * reflects current configuration.
   */
  loadTravelerFields?: (
    ctx: OwnedHandlerContext,
    productId: string,
  ) => Promise<ReadonlyArray<TravelerFieldRequirement>>

  /**
   * Resolve the addon catalog for the product (typically a projection
   * over `extras` + `option_extra_configs`). Caller-supplied to keep
   * the products package free of an @voyantjs/extras dependency.
   */
  loadAddonCatalog?: (
    ctx: OwnedHandlerContext,
    productId: string,
  ) => Promise<ReadonlyArray<AddonOffer>>

  /**
   * Resolve the tax rate for a given (product, buyer country) pair.
   * Templates wire this to a function that reads
   * `products.tax_class_id`, `tax_classes.default_regime_id`, and
   * `tax_regimes.rate_percent`. Returns null when tax can't be
   * resolved — the engine renders the breakdown without a tax line.
   *
   * Per booking-journey-architecture §9.
   */
  loadTaxRate?: (
    ctx: OwnedHandlerContext,
    args: {
      productId: string
      buyerCountry?: string
      buyerType?: "B2C" | "B2B"
    },
  ) => Promise<ResolvedTaxRate | null>

  /**
   * Resolve the option price rule for a given (product, option, date)
   * — typically backed by `@voyantjs/pricing`'s
   * `resolveOptionPriceRulesForDate` plus a join into per-unit prices.
   * Returns null when no rule applies or the resolver can't run; the
   * handler then falls back to `product.sellAmountCents × pax`.
   *
   * Caller-supplied so `@voyantjs/products` does not import
   * `@voyantjs/pricing` (the dependency direction is pricing →
   * products, not the reverse).
   */
  loadResolvedOptionPrice?: (
    ctx: OwnedHandlerContext,
    args: {
      productId: string
      optionId: string
      /** ISO yyyy-mm-dd in the slot's local timezone. */
      date: string
      catalogId?: string
    },
  ) => Promise<ResolvedOptionPrice | null>

  /**
   * Look up the local date of a departure slot (`availability_slots`).
   * Caller-supplied so the products package does not import
   * `@voyantjs/availability`. Returns null when the slot is missing.
   *
   * Used together with `loadResolvedOptionPrice` to convert a draft's
   * `departureSlotId` into a date the resolver can match against.
   */
  loadSlotDate?: (ctx: OwnedHandlerContext, slotId: string) => Promise<string | null>
}

/**
 * Caller-supplied availability-hold bridge — keeps the products
 * package free of an `@voyantjs/availability` dependency. When
 * wired, the handler's `placeHold/extendHold/releaseHold` route
 * through `availability_holds` (real inventory locks). When
 * omitted, the handler falls back to stamping no-ops.
 */
export interface AvailabilityHoldBridge {
  place: (input: {
    draftId: string
    productId: string
    slotId: string
    paxCount: number
    ttlMs: number
    holdToken?: string
  }) => Promise<
    | { status: "ok"; holdToken: string; expiresAt: Date }
    | { status: "slot_not_found" }
    | { status: "insufficient_capacity"; remaining: number; needed: number }
  >
  extend: (input: {
    holdToken: string
    ttlMs: number
  }) => Promise<{ status: "ok"; expiresAt: Date } | { status: "not_found" }>
  release: (holdToken: string) => Promise<void>
}

export interface CreateProductsBookingHandlerOptions extends OwnedProductsShapeLoaders {
  /**
   * Caller-supplied bridge to `bookingsCreate`. Wired by the
   * template at boot, since `@voyantjs/products` does not import
   * `@voyantjs/finance`.
   */
  createBooking: BookingCreateBridge
  /**
   * Generator for booking numbers. Defaults to a timestamp-based
   * value if not supplied. Templates that have a sequence service
   * (operator: numbering plugin) override.
   */
  generateBookingNumber?: () => string
  /**
   * Optional inventory-hold bridge. When wired, `placeHold`
   * decrements `availability_slots.remainingPax` against the
   * draft's chosen slot; `releaseHold` restores it. When omitted,
   * the handler returns a stamping token without touching
   * inventory.
   */
  holds?: AvailabilityHoldBridge
}

export function createProductsBookingHandler(
  options: CreateProductsBookingHandlerOptions,
): OwnedBookingHandler {
  const generateNumber = options.generateBookingNumber ?? defaultBookingNumber

  return {
    entityModule: "products",

    async computeQuote(
      ctx: OwnedHandlerContext,
      request: ComputeQuoteRequest,
    ): Promise<ComputeQuoteResult> {
      const product = await loadProduct(ctx.db, request.entityId)
      if (!product) {
        return { available: false, invalidReason: "product_not_found" }
      }
      if (product.status !== "active" && product.status !== "draft") {
        return {
          available: false,
          invalidReason: `product_status_${product.status}`,
        }
      }

      const draft = (request.draft ?? {}) as DraftLike
      const optionId = draft.configure?.variantId
      const slotId = draft.configure?.departureSlotId

      // Concurrent enrichment + slot-date lookup. The slot date is
      // needed before we can call loadResolvedOptionPrice, so it
      // joins this batch.
      const [travelerFields, addonCatalog, taxRate, slotDate] = await Promise.all([
        options.loadTravelerFields?.(ctx, request.entityId) ?? Promise.resolve(undefined),
        options.loadAddonCatalog?.(ctx, request.entityId) ?? Promise.resolve(undefined),
        options.loadTaxRate?.(ctx, {
          productId: request.entityId,
          buyerCountry: draft.billing?.address?.country,
          buyerType: draft.billing?.buyerType,
        }) ?? Promise.resolve(null),
        slotId && options.loadSlotDate
          ? options.loadSlotDate(ctx, slotId)
          : Promise.resolve(draft.configure?.departureDate ?? null),
      ])

      const resolvedPrice =
        optionId && slotDate && options.loadResolvedOptionPrice
          ? await options.loadResolvedOptionPrice(ctx, {
              productId: request.entityId,
              optionId,
              date: slotDate,
            })
          : null

      const paxCount = sumPax(draft.configure?.pax)
      // Per-pax pricing fallback: when no pax is supplied yet, quote a
      // single-occupant baseline so the wizard can render a starter
      // total before the user picks counts.
      const effectivePax = paxCount > 0 ? paxCount : 1

      const priced = priceQuote({
        product,
        resolvedPrice,
        pax: draft.configure?.pax,
        effectivePax,
      })

      // Tax computation. The base is taxable; addons/accommodation
      // get the same rate in this MVP cut. Per-line override (the
      // `applies_to` axis on tax_classes.lines) lands in a follow-up
      // when the catalog actually carries mixed treatments.
      const taxIsInclusive = taxRate?.priceMode === "inclusive"
      const grossCents = priced.totalCents
      const taxCents =
        taxRate && taxRate.rate > 0
          ? taxIsInclusive
            ? Math.round(grossCents - grossCents / (1 + taxRate.rate))
            : Math.round(grossCents * taxRate.rate)
          : 0
      const netCents = taxIsInclusive ? grossCents - taxCents : grossCents
      const payableCents = taxIsInclusive ? grossCents : netCents + taxCents

      const available = grossCents > 0
      const pricing = available
        ? {
            base_amount: netCents,
            taxes: taxCents,
            fees: 0,
            surcharges: 0,
            currency: product.sellCurrency,
            breakdown: {
              lines: priced.lines.map((line) => ({
                ...line,
                taxIncluded: taxIsInclusive,
              })),
              taxes:
                taxRate && taxCents > 0
                  ? [
                      {
                        code: taxRate.code,
                        label: taxRate.label,
                        rate: taxRate.rate,
                        amount: taxCents,
                        base: netCents,
                        includedInPrice: taxIsInclusive,
                        scope: taxIsInclusive ? "included" : "excluded",
                      },
                    ]
                  : [],
              subtotal: netCents,
              taxTotal: taxCents,
              total: payableCents,
              paxCount: effectivePax,
            } as Record<string, unknown>,
          }
        : undefined

      return {
        available,
        invalidReason: available ? undefined : "no_sell_amount_configured",
        pricing,
        shape: buildOwnedProductDraftShape({
          travelerFields,
          addonCatalog,
        }),
      }
    },

    /**
     * Place a soft hold on the row's chosen slot. When the
     * `holds` bridge is wired, decrements
     * `availability_slots.remainingPax` against the slot for the
     * pax count; concurrent placeHold attempts are serialized via
     * a row-level lock inside the bridge. When omitted, returns a
     * stamping token without touching inventory.
     *
     * The slot id and pax count are pulled off
     * `request.parameters.slotId` / `request.parameters.paxCount`
     * — the journey wizard threads these from the draft's
     * Configure step (`departureSlotId` + summed `pax`).
     */
    async placeHold(_ctx: OwnedHandlerContext, request) {
      const token = request.draftId ?? defaultBookingNumber()
      const expiresAt = new Date(Date.now() + request.ttlMs)
      if (!options.holds) {
        return { holdToken: token, expiresAt }
      }
      const params = (request.parameters ?? {}) as {
        slotId?: string
        paxCount?: number
        productId?: string
      }
      const slotId = params.slotId
      const paxCount = params.paxCount ?? 1
      if (!slotId || !request.draftId) {
        // No slot chosen yet → no inventory to lock. Return a
        // stamping token so the journey can still call extend /
        // release.
        return { holdToken: token, expiresAt }
      }
      const result = await options.holds.place({
        draftId: request.draftId,
        productId: params.productId ?? request.entityId,
        slotId,
        paxCount,
        ttlMs: request.ttlMs,
        holdToken: token,
      })
      if (result.status === "ok") {
        return { holdToken: result.holdToken, expiresAt: result.expiresAt }
      }
      // Capacity / lookup failures fall back to a stamping token
      // — the journey commit will revalidate via the engine's
      // re-quote and reject if capacity has dried up.
      return { holdToken: token, expiresAt }
    },

    async extendHold(_ctx: OwnedHandlerContext, holdToken: string, request?: { ttlMs?: number }) {
      const ttlMs = request?.ttlMs ?? 30 * 60 * 1000
      if (options.holds) {
        const result = await options.holds.extend({ holdToken, ttlMs })
        if (result.status === "ok") {
          return { holdToken, expiresAt: result.expiresAt }
        }
      }
      return { holdToken, expiresAt: new Date(Date.now() + ttlMs) }
    },

    async releaseHold(_ctx: OwnedHandlerContext, holdToken: string) {
      if (options.holds) {
        await options.holds.release(holdToken)
      }
    },

    async commit(
      ctx: OwnedHandlerContext,
      request: CommitOwnedRequest,
    ): Promise<CommitOwnedResult> {
      const draft = (request.draft ?? {}) as DraftLike
      // Defensive product load — the bridge will fail with
      // `product_not_found` anyway, but a clean early-return keeps the
      // commit path's error envelope predictable.
      const product = await loadProduct(ctx.db, request.entityId)
      if (!product) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: { reason: "product_not_found" },
        }
      }

      const travelers = (draft.travelers ?? []).map((t) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        participantType: "traveler" as const,
        travelerCategory:
          t.band === "child" || t.band === "infant"
            ? (t.band as "child" | "infant")
            : ("adult" as const),
      }))

      // Promotion-discounted quotes: thread the discounted customer-
      // facing amount into the booking's seed sellAmountCents so
      // checkout / payment see the quoted amount, not the product list
      // price. Inclusive-tax quotes rewrite `base_amount` to net
      // subtotal during tax recompute, so derive the override from the
      // gross breakdown total when an included tax line is present.
      const sellAmountCentsOverride = resolveSellAmountCentsOverride(request.pricing)

      const bridge = await options.createBooking({
        productId: product.id,
        bookingNumber: generateNumber(),
        personId: extractPersonId(request.party),
        organizationId: extractOrganizationId(request.party),
        internalNotes: extractInternalNotes(request.party),
        travelers: travelers.length > 0 ? travelers : undefined,
        sellAmountCentsOverride,
        taxLines: extractTaxLines(request.pricing),
      })

      if (bridge.status !== "ok" || !bridge.bookingId) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: { bridge },
        }
      }

      return {
        status: "held",
        orderRef: bridge.bookingNumber ?? bridge.bookingId,
        pricing: request.pricing,
        upstreamPayload: { bridgeBookingId: bridge.bookingId },
      }
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function loadProduct(
  db: AnyDrizzleDb,
  productId: string,
): Promise<typeof products.$inferSelect | undefined> {
  const drizzle = db as unknown as PostgresJsDatabase
  const rows = (await drizzle
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)) as Array<typeof products.$inferSelect>
  return rows[0]
}

function sumPax(pax: Partial<Record<string, number>> | undefined): number {
  if (!pax) return 0
  let total = 0
  for (const v of Object.values(pax)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) total += v
  }
  return total
}

interface PricedLine {
  kind: "base"
  label: string
  quantity: number
  unitAmount: number
  totalAmount: number
}

interface PricedQuote {
  totalCents: number
  lines: PricedLine[]
}

/**
 * Three-way price computation:
 *
 * 1. **Per-band** (preferred): when `resolvedPrice.unitPrices` matches
 *    at least one band with positive count, sum `pax[band] ×
 *    unit.sellAmountCents` for each matching band. One breakdown line
 *    per band.
 *
 * 2. **Per-booking**: when no per-band match but `baseSellAmountCents`
 *    is set, charge a single `base × paxCount` line.
 *
 * 3. **Fallback**: `product.sellAmountCents × paxCount`. Same shape as
 *    Phase A behavior, kept for bookings without an option/slot
 *    configured yet.
 */
function priceQuote(input: {
  product: typeof products.$inferSelect
  resolvedPrice: ResolvedOptionPrice | null
  pax: Partial<Record<string, number>> | undefined
  effectivePax: number
}): PricedQuote {
  const { product, resolvedPrice, pax, effectivePax } = input

  if (resolvedPrice && resolvedPrice.unitPrices.length > 0) {
    const bandLines: PricedLine[] = []
    let total = 0
    for (const unit of resolvedPrice.unitPrices) {
      if (!unit.travelerCategory) continue
      const count = pax?.[unit.travelerCategory] ?? 0
      if (count <= 0) continue
      const sell = unit.sellAmountCents ?? 0
      if (sell <= 0) continue
      const lineTotal = sell * count
      total += lineTotal
      bandLines.push({
        kind: "base",
        label: `${product.name} — ${unit.travelerCategory}`,
        quantity: count,
        unitAmount: sell,
        totalAmount: lineTotal,
      })
    }
    if (bandLines.length > 0) {
      return { totalCents: total, lines: bandLines }
    }
  }

  if (resolvedPrice && resolvedPrice.baseSellAmountCents !== null) {
    const unitCents = resolvedPrice.baseSellAmountCents
    const totalCents = unitCents * effectivePax
    return {
      totalCents,
      lines: [
        {
          kind: "base",
          label: product.name,
          quantity: effectivePax,
          unitAmount: unitCents,
          totalAmount: totalCents,
        },
      ],
    }
  }

  const unitCents = product.sellAmountCents ?? 0
  const totalCents = unitCents * effectivePax
  return {
    totalCents,
    lines: [
      {
        kind: "base",
        label: product.name,
        quantity: effectivePax,
        unitAmount: unitCents,
        totalAmount: totalCents,
      },
    ],
  }
}

function extractPersonId(party: Record<string, unknown> | undefined): string | undefined {
  if (!party) return undefined
  const v = party.personId
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function extractOrganizationId(party: Record<string, unknown> | undefined): string | undefined {
  if (!party) return undefined
  const v = party.organizationId
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function extractInternalNotes(party: Record<string, unknown> | undefined): string | undefined {
  if (!party) return undefined
  const v = party.internalNotes
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function extractTaxLines(
  pricing: CommitOwnedRequest["pricing"],
): BookingCreateBridgeInput["taxLines"] {
  const breakdown = pricing?.breakdown
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return undefined
  const taxes = (breakdown as { taxes?: unknown }).taxes
  if (!Array.isArray(taxes)) return undefined

  const lines: NonNullable<BookingCreateBridgeInput["taxLines"]> = []
  for (const [index, tax] of taxes.entries()) {
    if (!tax || typeof tax !== "object" || Array.isArray(tax)) continue
    const row = tax as Record<string, unknown>
    const amountCents = asFiniteInteger(row.amount)
    const rate = typeof row.rate === "number" && Number.isFinite(row.rate) ? row.rate : null
    const currency =
      typeof pricing?.currency === "string" && pricing.currency.length === 3
        ? pricing.currency
        : "EUR"
    const name = typeof row.label === "string" && row.label.length > 0 ? row.label : "Tax"
    if (!amountCents || amountCents <= 0) continue
    const includedInPrice = row.includedInPrice === true || row.scope === "included"
    lines.push({
      code: typeof row.code === "string" ? row.code : null,
      name,
      scope: includedInPrice ? "included" : "excluded",
      currency,
      amountCents,
      rateBasisPoints: rate == null ? null : Math.round(rate * 10_000),
      includedInPrice,
      sortOrder: index,
    })
  }

  return lines.length ? lines : undefined
}

function resolveSellAmountCentsOverride(pricing: CommitOwnedRequest["pricing"]): number | null {
  if (!pricing) return null
  const breakdown = pricing.breakdown
  if (hasInclusiveTaxLine(breakdown)) {
    const total = readBreakdownTotal(breakdown)
    if (total != null) return total
  }
  return pricing.base_amount != null ? Math.round(pricing.base_amount) : null
}

function hasInclusiveTaxLine(breakdown: unknown): boolean {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return false
  const taxes = (breakdown as { taxes?: unknown }).taxes
  if (!Array.isArray(taxes)) return false
  return taxes.some((tax) => {
    if (!tax || typeof tax !== "object" || Array.isArray(tax)) return false
    const row = tax as Record<string, unknown>
    return row.includedInPrice === true || row.scope === "included"
  })
}

function readBreakdownTotal(breakdown: unknown): number | null {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return null
  const total = (breakdown as { total?: unknown }).total
  return typeof total === "number" && Number.isFinite(total) ? Math.round(total) : null
}

function asFiniteInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

function defaultBookingNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  return `BK-${ts}`
}
