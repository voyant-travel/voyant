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
    rooms?: ReadonlyArray<{ optionUnitId: string; quantity: number }>
  }
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

export interface CreateHospitalityBookingHandlerOptions {
  /** Loader for the property's content payload. */
  loadContent: HospitalityContentLoader
  /**
   * Default min/max nights when the supplier hasn't declared bounds.
   * The journey's date-range sub-step uses these as guard rails.
   */
  defaultMinNights?: number
  defaultMaxNights?: number
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
      _request: CommitOwnedRequest,
    ): Promise<CommitOwnedResult> {
      // Real implementation needs to:
      //  1. Insert a stayBookingItems row (check-in / check-out /
      //     room-type / occupancy).
      //  2. Generate stayDailyRates rows for each night.
      //  3. Tie back to a parent booking shell created via
      //     bookingsService.createBookingFromProduct (or a hospitality
      //     equivalent — the property isn't a `products` row).
      //
      // None of that exists in @voyantjs/hospitality today. Until it
      // does, this stub returns failed so callers fail fast rather
      // than getting a fake-success snapshot.
      return {
        status: "failed",
        orderRef: "",
        upstreamPayload: { reason: "hospitality_commit_not_yet_implemented" },
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
