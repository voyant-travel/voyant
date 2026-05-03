/**
 * Owned-arm booking handler for the `hospitality` vertical.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §6.
 *
 * Phase B scope (deliberately narrow):
 *   - `computeQuote` projects the property's hospitality content
 *     into a `BookingDraftShape` with date-range + occupancy
 *     sub-steps and a Rooms accommodation step. Pricing is best-
 *     effort: `nights × room_count × baseRateHint` when the content
 *     surfaces a rate hint; otherwise no pricing returned (the
 *     wizard hides the total until a real quote lands).
 *   - `commit` returns `failed:not_yet_implemented` — the real
 *     stay-booking-items + daily-rates write is a follow-up that
 *     belongs in the hospitality module's own commit primitive.
 *
 * Templates wire this handler at boot the same way they wire the
 * products handler. Once `commit` ships, the registry is genuinely
 * multi-vertical with no further dispatch changes.
 */

import type {
  BookingDraftShape,
  CommitOwnedRequest,
  CommitOwnedResult,
  ComputeQuoteRequest,
  ComputeQuoteResult,
  OwnedBookingHandler,
  OwnedHandlerContext,
  RoomOption,
} from "@voyantjs/catalog/booking-engine"

import type { HospitalityContent } from "../content-shape.js"
import { buildHospitalityDraftShape } from "../draft-shape.js"

interface DraftLike {
  configure?: {
    pax?: Partial<Record<string, number>>
    dateRange?: { checkIn?: string; checkOut?: string }
  }
  accommodation?: {
    rooms?: ReadonlyArray<{ optionUnitId: string; quantity: number; ratePlanId?: string }>
  }
  billing?: {
    contact?: { firstName?: string; lastName?: string; email?: string; phone?: string }
    address?: { country?: string }
  }
  travelers?: Array<{
    firstName: string
    lastName: string
    band?: string
  }>
  internalNotes?: string
}

/**
 * Caller-supplied loader — keeps the handler free of a hard
 * dependency on the template's content service wiring (which spans
 * sourced + owned + overlays). Templates wire this to
 * `getHospitalityContent` from `@voyantjs/hospitality/service-content`.
 */
export type HospitalityContentLoader = (
  ctx: OwnedHandlerContext,
  entityId: string,
) => Promise<HospitalityContent | null>

/**
 * Subset of `hospitalityBookingsService.createStayBooking`'s
 * input. Structural so the handler stays free of a self-import
 * cycle.
 */
export interface HospitalityCommitBridgeInput {
  propertyId: string
  roomTypeId: string
  ratePlanId: string
  mealPlanId?: string | null
  checkInDate: string
  checkOutDate: string
  roomCount?: number
  adults?: number
  children?: number
  infants?: number
  dailyRates: Array<{
    sellCurrency: string
    sellAmountCents?: number | null
    costCurrency?: string | null
    costAmountCents?: number | null
  }>
  personId?: string | null
  organizationId?: string | null
  contact: {
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    country?: string | null
  }
  passengers: Array<{
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
    isPrimary?: boolean | null
  }>
  notes?: string | null
}

export interface HospitalityCommitBridgeResult {
  status: "ok" | "failed"
  bookingId?: string
  bookingNumber?: string
  reason?: string
}

export type HospitalityCommitBridge = (
  input: HospitalityCommitBridgeInput,
  options?: { userId?: string },
) => Promise<HospitalityCommitBridgeResult>

export interface CreateHospitalityBookingHandlerOptions {
  /** Loader for the property's content payload. */
  loadContent: HospitalityContentLoader
  /**
   * Default min/max nights when the supplier hasn't declared bounds.
   * The journey's date-range sub-step uses these as guard rails.
   */
  defaultMinNights?: number
  defaultMaxNights?: number
  /**
   * Caller-supplied bridge to
   * `hospitalityBookingsService.createStayBooking`. When omitted,
   * commit returns `failed:hospitality_commit_bridge_not_wired`.
   *
   * The journey doesn't currently surface room-type / rate-plan
   * picks at the granularity reserveStay needs (specifically
   * `ratePlanId` and per-night `dailyRates`). Until the journey's
   * Accommodation step + content shape extend to expose those, the
   * caller may map drafts to a "best guess" room/rate from the
   * descriptor's room-options projection — we leave that decision
   * to the template.
   */
  commitBridge?: HospitalityCommitBridge
}

export function createHospitalityBookingHandler(
  options: CreateHospitalityBookingHandlerOptions,
): OwnedBookingHandler {
  return {
    entityModule: "hospitality",

    async computeQuote(
      ctx: OwnedHandlerContext,
      request: ComputeQuoteRequest,
    ): Promise<ComputeQuoteResult> {
      const content = await options.loadContent(ctx, request.entityId)
      if (!content) {
        return { available: false, invalidReason: "property_not_found" }
      }

      const shape: BookingDraftShape = buildHospitalityDraftShape(content, {
        minNights: options.defaultMinNights,
        maxNights: options.defaultMaxNights,
      })

      const draft = (request.draft ?? {}) as DraftLike
      const pricing = computeBestEffortPricing(shape, draft)

      return {
        available: true,
        pricing,
        shape,
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
          upstreamPayload: { reason: "hospitality_commit_bridge_not_wired" },
        }
      }

      const draft = (request.draft ?? {}) as DraftLike
      const range = draft.configure?.dateRange
      if (!range?.checkIn || !range?.checkOut) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: {
            reason: "hospitality_commit_missing_inputs",
            need: ["dateRange.checkIn", "dateRange.checkOut"],
          },
        }
      }

      // Map the draft's room selection into a single (roomType, ratePlan) pair.
      // The journey's Accommodation step picks an option_unit_id (which is
      // hospitality's `roomTypeId`); rate plan defaults to the room's first
      // available — templates can override the default by augmenting the
      // bridge output. When no room is picked yet, the commit fails fast.
      const firstRoom = draft.accommodation?.rooms?.[0]
      if (!firstRoom) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: {
            reason: "hospitality_commit_missing_inputs",
            need: ["accommodation.rooms[0]"],
          },
        }
      }

      const adults = draft.configure?.pax?.adult ?? draft.travelers?.length ?? 1
      const children = draft.configure?.pax?.child ?? 0
      const infants = draft.configure?.pax?.infant ?? 0

      const billing = draft.billing ?? {}
      const contact = {
        firstName: billing.contact?.firstName ?? "",
        lastName: billing.contact?.lastName ?? "",
        email: billing.contact?.email ?? null,
        phone: billing.contact?.phone ?? null,
        country: billing.address?.country ?? null,
      }

      const passengers = (draft.travelers ?? []).map((t, idx) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        travelerCategory:
          t.band === "child" || t.band === "infant"
            ? (t.band as "child" | "infant")
            : ("adult" as const),
        isPrimary: idx === 0,
      }))
      if (passengers.length === 0) {
        passengers.push({
          firstName: contact.firstName,
          lastName: contact.lastName,
          travelerCategory: "adult",
          isPrimary: true,
        })
      }

      // Per-night rate hint from the draft's pricing breakdown
      // (computed by the handler earlier). The bridge expects
      // `dailyRates[]` with one entry per night — we replicate the
      // averaged hint across nights as a placeholder; production
      // needs supplier-provided rate-plan rows.
      const nights = nightsBetween(range.checkIn, range.checkOut)
      const totalCents = readPricingTotalCents(request.pricing)
      const perNightCents =
        nights > 0 && totalCents > 0 ? Math.round(totalCents / nights / firstRoom.quantity) : 0
      const currency = readPricingCurrency(request.pricing) ?? "EUR"
      const dailyRates = Array.from({ length: nights }, () => ({
        sellCurrency: currency,
        sellAmountCents: perNightCents,
      }))

      // The journey now surfaces rate-plan choice via the descriptor's
      // `RoomOption.ratePlans`. When the user hasn't picked one — e.g.
      // the property has no rate plans configured — the commit fails
      // with a helpful reason; the bridge no longer guesses.
      if (!firstRoom.ratePlanId) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: {
            reason: "hospitality_commit_missing_inputs",
            need: ["accommodation.rooms[0].ratePlanId"],
          },
        }
      }

      const bridge = await options.commitBridge({
        propertyId: request.entityId,
        roomTypeId: firstRoom.optionUnitId,
        ratePlanId: firstRoom.ratePlanId,
        checkInDate: range.checkIn,
        checkOutDate: range.checkOut,
        roomCount: firstRoom.quantity,
        adults,
        children,
        infants,
        dailyRates,
        personId: extractPersonId(request.party),
        organizationId: extractOrganizationId(request.party),
        contact,
        passengers,
        notes: typeof draft.internalNotes === "string" ? draft.internalNotes : null,
      })

      if (bridge.status !== "ok" || !bridge.bookingId) {
        return {
          status: "failed",
          orderRef: "",
          upstreamPayload: { reason: bridge.reason ?? "hospitality_commit_failed" },
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
      const token = request.draftId ?? `hosp_${Date.now().toString(36)}`
      return {
        holdToken: token,
        expiresAt: new Date(Date.now() + request.ttlMs),
      }
    },

    async releaseHold(_ctx, _holdToken) {
      // No-op until inventory reservation against rate plans + room
      // inventory lands.
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// Pricing heuristic
// ─────────────────────────────────────────────────────────────────

function computeBestEffortPricing(
  shape: BookingDraftShape,
  draft: DraftLike,
):
  | {
      base_amount: number
      taxes: number
      fees: number
      surcharges: number
      currency: string
      breakdown: Record<string, unknown>
    }
  | undefined {
  const range = draft.configure?.dateRange
  if (!range?.checkIn || !range?.checkOut) return undefined

  const nights = nightsBetween(range.checkIn, range.checkOut)
  if (nights <= 0) return undefined

  const rooms = draft.accommodation?.rooms ?? []
  const totalRooms = rooms.length === 0 ? 1 : rooms.reduce((sum, r) => sum + r.quantity, 0)
  if (totalRooms <= 0) return undefined

  // Pick the cheapest available room option's hint (when surfaced).
  // The journey's Configure step doesn't pin a rate until the user
  // picks a room — this is just a starter total.
  const roomOptions = (shape.accommodation?.roomOptions ?? []) as ReadonlyArray<RoomOption>
  const hint = roomOptions
    .map((r) => r.baseRateHint ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)[0]
  if (!hint) return undefined

  const totalCents = hint * nights * totalRooms
  return {
    base_amount: totalCents,
    taxes: 0,
    fees: 0,
    surcharges: 0,
    // Currency is unknown until the rate plan is picked — fall back
    // to EUR as the most common storefront default. Real commits
    // override at quote time.
    currency: "EUR",
    breakdown: {
      lines: [
        {
          kind: "accommodation",
          label: `${totalRooms} room × ${nights} night${nights === 1 ? "" : "s"}`,
          quantity: nights * totalRooms,
          unitAmount: hint,
          totalAmount: totalCents,
        },
      ],
      subtotal: totalCents,
      taxTotal: 0,
      total: totalCents,
      nights,
      rooms: totalRooms,
    },
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn)
  const outDate = new Date(checkOut)
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return 0
  const ms = outDate.getTime() - inDate.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
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

function readPricingTotalCents(
  pricing: { base_amount?: number; taxes?: number } | undefined,
): number {
  if (!pricing) return 0
  return (pricing.base_amount ?? 0) + (pricing.taxes ?? 0)
}

function readPricingCurrency(pricing: { currency?: string } | undefined): string | undefined {
  return pricing?.currency
}
