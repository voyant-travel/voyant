/**
 * Owned-arm booking handler for the `cruises` vertical (Phase F
 * skeleton).
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6 +
 * §7 (cruise example) + §10 Phase F.
 *
 * computeQuote scope:
 *   - Reads cruise content via the caller-supplied loader
 *     (`getCruiseContent`).
 *   - Projects to a `BookingDraftShape` with cabin-category +
 *     occupancy sub-steps via `buildCruiseDraftShape`.
 *   - When a sailing + cabin category + occupancy are picked,
 *     looks up the per-occupancy `cruise_prices` row and returns
 *     pricing as `pricePerPerson × paxCount`.
 *
 * commit scope:
 *   - Returns `failed:not_yet_implemented`. Cruises need a
 *     vertical-specific commit primitive (cabin allocation +
 *     supplier hold + air-add-on routing) that doesn't exist
 *     today. The shell renders the descriptor cleanly; commit
 *     lands separately.
 */

import type {
  BookingDraftShape,
  CommitOwnedRequest,
  CommitOwnedResult,
  ComputeQuoteRequest,
  ComputeQuoteResult,
  OwnedBookingHandler,
  OwnedHandlerContext,
} from "@voyantjs/catalog/booking-engine"

import type { CruiseContent } from "../content-shape.js"
import { buildCruiseDraftShape } from "../draft-shape.js"

interface DraftLike {
  configure?: {
    pax?: Partial<Record<string, number>>
    departureSlotId?: string
    cabinCategoryId?: string
    cabinNumberId?: string
    variantId?: string
  }
  billing?: {
    contact?: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
    }
    company?: { name?: string }
  }
  travelers?: Array<{
    firstName: string
    lastName: string
    dateOfBirth?: string
    band?: string
  }>
  internalNotes?: string
}

export interface ResolvedCruisePrice {
  /** Per-pax price in major units as a numeric string (matches
   *  cruise_prices.pricePerPerson). */
  pricePerPerson: string
  currency: string
  fareCode?: string | null
}

/**
 * Caller-supplied loaders. Templates wire these to
 * `getCruiseContent` and `pricingService.lowestAvailablePrice` /
 * a custom per-(category, occupancy) lookup.
 */
export interface CruiseHandlerLoaders {
  loadContent: (ctx: OwnedHandlerContext, entityId: string) => Promise<CruiseContent | null>
  /**
   * Resolve a price for the chosen sailing + category + occupancy.
   * Returns null when no available row matches (e.g. cabin
   * category is sold out at that occupancy).
   */
  loadPrice: (
    ctx: OwnedHandlerContext,
    args: {
      entityId: string
      sailingId: string
      cabinCategoryId: string
      occupancy: number
    },
  ) => Promise<ResolvedCruisePrice | null>
}

/**
 * Subset of `cruisesBookingService.createCruiseBooking`'s input —
 * structural so the handler stays free of an
 * `@voyantjs/cruises/service-bookings` import (no workspace cycle).
 */
export interface CruiseCommitBridgeInput {
  sailingId: string
  cabinCategoryId: string
  cabinId?: string | null
  occupancy: number
  fareCode?: string | null
  personId?: string | null
  organizationId?: string | null
  contact: {
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
  }
  passengers: Array<{
    firstName: string
    lastName: string
    dateOfBirth?: string | null
    travelerCategory?: "adult" | "child" | "infant" | null
  }>
  notes?: string | null
}

export interface CruiseCommitBridgeResult {
  status: "ok" | "failed"
  bookingId?: string
  bookingNumber?: string
  reason?: string
}

export type CruiseCommitBridge = (
  input: CruiseCommitBridgeInput,
  options?: { userId?: string },
) => Promise<CruiseCommitBridgeResult>

export interface CreateCruiseBookingHandlerOptions extends CruiseHandlerLoaders {
  /** Force the wizard to render a cabin-number sub-step even when
   *  the supplier doesn't surface a cabin map. Defaults to false. */
  forceCabinNumberSubStep?: boolean
  /** Pass `true` when the deployment ships an insurance offer. */
  includeInsurance?: boolean
  /**
   * Caller-supplied bridge to `cruisesBookingService.createCruiseBooking`.
   * When provided, `commit` calls into the cruise vertical's
   * transactional booking path; when omitted, `commit` returns
   * `failed:cruise_commit_not_yet_implemented`.
   *
   * Templates wire this with a small adapter:
   *   `(input, opts) => cruisesBookingService.createCruiseBooking(db, input, opts.userId)`
   */
  commitBridge?: CruiseCommitBridge
}

export function createCruiseBookingHandler(
  options: CreateCruiseBookingHandlerOptions,
): OwnedBookingHandler {
  return {
    entityModule: "cruises",

    async computeQuote(
      ctx: OwnedHandlerContext,
      request: ComputeQuoteRequest,
    ): Promise<ComputeQuoteResult> {
      const content = await options.loadContent(ctx, request.entityId)
      if (!content) {
        return { available: false, invalidReason: "cruise_not_found" }
      }

      const shape: BookingDraftShape = buildCruiseDraftShape(content, {
        forceCabinNumberSubStep: options.forceCabinNumberSubStep,
        includeInsurance: options.includeInsurance,
      })

      const draft = (request.draft ?? {}) as DraftLike
      const sailingId = draft.configure?.departureSlotId
      const cabinCategoryId = draft.configure?.cabinCategoryId
      const paxCount = sumPax(draft.configure?.pax)

      // Pricing requires (sailing, category, occupancy). Until the
      // user picks all three, return shape only — the wizard
      // renders the steps and waits.
      if (!sailingId || !cabinCategoryId || paxCount <= 0) {
        return { available: true, shape }
      }

      const price = await options.loadPrice(ctx, {
        entityId: request.entityId,
        sailingId,
        cabinCategoryId,
        occupancy: paxCount,
      })

      if (!price) {
        return {
          available: false,
          invalidReason: "no_price_for_occupancy",
          shape,
        }
      }

      const perPaxCents = priceStringToCents(price.pricePerPerson)
      const totalCents = perPaxCents * paxCount

      return {
        available: true,
        shape,
        pricing: {
          base_amount: totalCents,
          taxes: 0,
          fees: 0,
          surcharges: 0,
          currency: price.currency,
          breakdown: {
            lines: [
              {
                kind: "base",
                label: cabinCategoryLabel(content, cabinCategoryId, price.fareCode ?? null),
                quantity: paxCount,
                unitAmount: perPaxCents,
                totalAmount: totalCents,
              },
            ],
            subtotal: totalCents,
            taxTotal: 0,
            total: totalCents,
            paxCount,
            occupancy: paxCount,
            sailingId,
            cabinCategoryId,
            fareCode: price.fareCode ?? null,
          } as Record<string, unknown>,
        },
      }
    },

    async commit(
      _ctx: OwnedHandlerContext,
      request: CommitOwnedRequest,
    ): Promise<CommitOwnedResult> {
      if (!options.commitBridge) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: { reason: "cruise_commit_bridge_not_wired" },
        }
      }

      const draft = (request.draft ?? {}) as DraftLike
      const sailingId = draft.configure?.departureSlotId
      const cabinCategoryId = draft.configure?.cabinCategoryId
      const cabinId = draft.configure?.cabinNumberId
      const occupancy = sumPax(draft.configure?.pax)

      if (!sailingId || !cabinCategoryId || occupancy <= 0) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: {
            reason: "cruise_commit_missing_inputs",
            need: ["sailingId", "cabinCategoryId", "occupancy"],
          },
        }
      }

      const contact = {
        firstName: draft.billing?.contact?.firstName ?? "",
        lastName: draft.billing?.contact?.lastName ?? "",
        email: draft.billing?.contact?.email ?? null,
        phone: draft.billing?.contact?.phone ?? null,
      }

      const passengers = (draft.travelers ?? []).map((t) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        dateOfBirth: t.dateOfBirth ?? null,
        travelerCategory:
          t.band === "child" || t.band === "infant"
            ? (t.band as "child" | "infant")
            : ("adult" as const),
      }))

      // The cruise commit primitive demands at least one passenger;
      // if the journey didn't collect them, fall back to the lead
      // contact as a single passenger so the commit doesn't reject
      // outright. Operators using the journey for inquiry-style
      // bookings can fill traveler details from the booking detail
      // page later.
      if (passengers.length === 0) {
        passengers.push({
          firstName: contact.firstName,
          lastName: contact.lastName,
          dateOfBirth: null,
          travelerCategory: "adult",
        })
      }

      const bridge = await options.commitBridge({
        sailingId,
        cabinCategoryId,
        cabinId: cabinId ?? null,
        occupancy,
        fareCode: draft.configure?.variantId ?? null,
        personId: extractPersonId(request.party),
        organizationId: extractOrganizationId(request.party),
        contact,
        passengers,
        notes: draft.internalNotes ?? null,
      })

      if (bridge.status !== "ok" || !bridge.bookingId) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: { reason: bridge.reason ?? "cruise_commit_failed" },
        }
      }

      return {
        status: "held",
        orderRef: bridge.bookingNumber ?? bridge.bookingId,
        pricing: request.pricing,
        upstreamPayload: { bridgeBookingId: bridge.bookingId },
      }
    },

    async placeHold(_ctx, request) {
      const token = request.draftId ?? `cruise_${Date.now().toString(36)}`
      return {
        holdToken: token,
        expiresAt: new Date(Date.now() + request.ttlMs),
      }
    },

    async releaseHold(_ctx, _holdToken) {
      // No-op until supplier-side hold APIs are wired.
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

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

function priceStringToCents(price: string): number {
  // cruise_prices.pricePerPerson is numeric(precision, scale). The
  // major-unit string parses straight; round to integer cents.
  const major = Number.parseFloat(price)
  if (!Number.isFinite(major)) return 0
  return Math.round(major * 100)
}

function cabinCategoryLabel(
  content: CruiseContent,
  categoryId: string,
  fareCode: string | null,
): string {
  const category = content.cabin_categories.find((c) => c.id === categoryId)
  const base = category?.name ?? "Cabin"
  return fareCode ? `${base} (${fareCode})` : base
}
