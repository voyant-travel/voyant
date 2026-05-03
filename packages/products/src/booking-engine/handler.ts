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
 *   - An injected `quickCreateBooking` function for the commit path
 *     — keeps `@voyantjs/products` from depending on
 *     `@voyantjs/finance` (no workspace cycle).
 *
 * Phase A scope (deliberately narrow):
 *   - Price = product.sellAmountCents × pax_count, no taxes / addons /
 *     accommodation / vouchers.
 *   - Commit goes through the bridge into `bookingsQuickCreate`'s input
 *     shape — products-only, no extras / hospitality / cruises / encrypted
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
 * Subset of `bookingsQuickCreate`'s input the bridge builds.
 * Mirrors the schema in `service-bookings-quick-create.ts` — kept
 * structural here so we don't pull a dependency into products.
 */
export interface QuickCreateBridgeInput {
  productId: string
  optionId?: string | null
  slotId?: string | null
  bookingNumber: string
  personId?: string | null
  organizationId?: string | null
  internalNotes?: string | null
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
}

export interface QuickCreateBridgeResult {
  status: "ok" | "product_not_found" | string
  bookingId?: string
  bookingNumber?: string
}

/**
 * Caller-supplied bridge to `bookingsQuickCreate`. Templates wire
 * this up — `(input, opts) => quickCreateBooking(db as PostgresJsDatabase, input, opts)`.
 */
export type QuickCreateBridge = (
  input: QuickCreateBridgeInput,
  options?: { userId?: string },
) => Promise<QuickCreateBridgeResult>

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

/** Caller-supplied loaders for descriptor enrichment. Each is
 *  optional — when omitted the handler returns the default shape.
 *  Templates wire these to the modules they have on hand
 *  (booking-requirements, extras). */
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
}

export interface CreateProductsBookingHandlerOptions extends OwnedProductsShapeLoaders {
  /**
   * Caller-supplied bridge to `bookingsQuickCreate`. Wired by the
   * template at boot, since `@voyantjs/products` does not import
   * `@voyantjs/finance`.
   */
  quickCreate: QuickCreateBridge
  /**
   * Generator for booking numbers. Defaults to a timestamp-based
   * value if not supplied. Templates that have a sequence service
   * (operator: numbering plugin) override.
   */
  generateBookingNumber?: () => string
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
      // Concurrent enrichment — both calls are pure reads and don't
      // depend on each other.
      const [travelerFields, addonCatalog] = await Promise.all([
        options.loadTravelerFields?.(ctx, request.entityId) ?? Promise.resolve(undefined),
        options.loadAddonCatalog?.(ctx, request.entityId) ?? Promise.resolve(undefined),
      ])
      const paxCount = sumPax(draft.configure?.pax)
      // Per-pax pricing fallback: when no pax is supplied yet, quote a
      // single-occupant baseline so the wizard can render a starter
      // total before the user picks counts.
      const effectivePax = paxCount > 0 ? paxCount : 1
      const unitCents = product.sellAmountCents ?? 0
      const totalCents = unitCents * effectivePax

      const pricing =
        unitCents > 0
          ? {
              base_amount: totalCents,
              taxes: 0,
              fees: 0,
              surcharges: 0,
              currency: product.sellCurrency,
              breakdown: {
                lines: [
                  {
                    kind: "base",
                    label: product.name,
                    quantity: effectivePax,
                    unitAmount: unitCents,
                    totalAmount: totalCents,
                  },
                ],
                paxCount: effectivePax,
              } as Record<string, unknown>,
            }
          : undefined

      return {
        available: unitCents > 0,
        invalidReason: unitCents > 0 ? undefined : "no_sell_amount_configured",
        pricing,
        shape: buildOwnedProductDraftShape({
          travelerFields,
          addonCatalog,
        }),
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

      const bridge = await options.quickCreate({
        productId: product.id,
        bookingNumber: generateNumber(),
        personId: extractPersonId(request.party),
        organizationId: extractOrganizationId(request.party),
        internalNotes: extractInternalNotes(request.party),
        travelers: travelers.length > 0 ? travelers : undefined,
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

function defaultBookingNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  return `BK-${ts}`
}
