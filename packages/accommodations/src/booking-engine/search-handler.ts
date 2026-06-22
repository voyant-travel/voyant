/**
 * Owned-arm availability-search handler for the `accommodation` vertical.
 *
 * The counterpart of `createAccommodationBookingHandler`: it lets owned
 * accommodation inventory participate in the catalog availability fan-out
 * (`fanOutAvailabilitySearch`, RFC #2081/#2093) so owned and sourced supply
 * land in one ranked candidate list.
 *
 * Like the booking handler, this is a thin shell that delegates the actual
 * inventory query to a caller-supplied **bridge**. Owned accommodations have no
 * date-aware rate/availability table in the schema yet, and the location lookup
 * spans the operations (places/facility) schema — both deployment-specific — so
 * the handler owns the vertical-agnostic parts (criteria validation, nights,
 * candidate assembly) and the deployment owns the data access.
 */

import type { OwnedAvailabilitySearchHandler, OwnedSearchContext } from "@voyant-travel/catalog"
import type {
  AvailabilityCandidate,
  AvailabilitySearchRequest,
  AvailabilitySearchResult,
} from "@voyant-travel/catalog/adapter/contract"

/** Occupancy for one requested room. Mirrors the sourced stay-search shape. */
export interface AccommodationSearchOccupancy {
  adults: number
  children?: number
  childrenAges?: number[]
  infants?: number
}

/**
 * Accommodation-vertical search criteria. The composer/caller shapes
 * `AvailabilitySearchRequest.criteria` into this; `checkIn`/`checkOut`/`rooms`
 * are required.
 */
export interface AccommodationSearchCriteria {
  destination?: { countryCode?: string; region?: string; city?: string }
  near?: { latitude: number; longitude: number; radiusKm: number }
  checkIn: string
  checkOut: string
  rooms: AccommodationSearchOccupancy[]
  minStars?: number
  amenities?: string[]
  refundableOnly?: boolean
}

/** Validated criteria + derived context handed to the bridge. */
export interface AccommodationSearchBridgeInput {
  criteria: AccommodationSearchCriteria
  /** Nights between check-in and check-out (≥ 1). */
  nights: number
  scope: AvailabilitySearchRequest["scope"]
  limit?: number
  cursor?: string
}

/**
 * One owned room matched + priced for the requested stay. The bridge resolves
 * availability + price from wherever the deployment models owned rates; the
 * handler maps these onto `AvailabilityCandidate`s.
 */
export interface AccommodationSearchMatch {
  /** Entity id surfaced to the composer — typically the room type / accommodation id. */
  accommodationId: string
  roomTypeId: string
  ratePlanId: string
  occupancy: AccommodationSearchOccupancy
  /** Public total stay price across the date range. */
  price: { amount: string; currency: string }
  /** Stable ref for this match within the search; defaults to a composed key. */
  candidateRef?: string
  expiresAt?: Date
  /** Internal-only economics / raw row for reserve. Never serialized publicly. */
  providerData?: Record<string, unknown>
}

export type AccommodationSearchBridge = (
  ctx: OwnedSearchContext,
  input: AccommodationSearchBridgeInput,
) => Promise<{ matches: AccommodationSearchMatch[]; nextCursor?: string }>

export interface CreateAccommodationSearchHandlerOptions {
  /**
   * Resolves owned accommodation availability for a stay. Wired by the
   * deployment to its owned room/rate query (joins through the operations
   * places/facility schema + the deployment's rate source).
   */
  searchBridge: AccommodationSearchBridge
}

export function createAccommodationOwnedSearchHandler(
  options: CreateAccommodationSearchHandlerOptions,
): OwnedAvailabilitySearchHandler {
  return {
    entityModule: "accommodations",
    async searchAvailability(
      ctx: OwnedSearchContext,
      request: AvailabilitySearchRequest,
    ): Promise<AvailabilitySearchResult> {
      const criteria = parseAccommodationCriteria(request.criteria)
      const nights = nightsBetween(criteria.checkIn, criteria.checkOut)
      const { matches, nextCursor } = await options.searchBridge(ctx, {
        criteria,
        nights,
        scope: request.scope,
        limit: request.limit,
        cursor: request.cursor,
      })
      const candidates = matches.map((match) => matchToCandidate(match, criteria))
      return {
        candidates,
        status: candidates.length > 0 ? "ok" : "empty",
        next_cursor: nextCursor,
      }
    },
  }
}

function parseAccommodationCriteria(
  criteria: Record<string, unknown>,
): AccommodationSearchCriteria {
  const c = criteria as Partial<AccommodationSearchCriteria>
  if (typeof c.checkIn !== "string" || typeof c.checkOut !== "string") {
    throw new Error(
      "Accommodation search requires `checkIn` and `checkOut` (ISO dates) in criteria",
    )
  }
  if (!Array.isArray(c.rooms) || c.rooms.length === 0) {
    throw new Error("Accommodation search requires a non-empty `rooms` array in criteria")
  }
  return c as AccommodationSearchCriteria
}

/** Whole nights between two ISO dates (UTC), floored to ≥ 1. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(checkIn)
  const end = Date.parse(checkOut)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Accommodation search `checkIn`/`checkOut` must be valid ISO dates")
  }
  const nights = Math.round((end - start) / 86_400_000)
  return nights >= 1 ? nights : 1
}

function matchToCandidate(
  match: AccommodationSearchMatch,
  criteria: AccommodationSearchCriteria,
): AvailabilityCandidate {
  return {
    candidateRef:
      match.candidateRef ??
      `${match.accommodationId}:${match.roomTypeId}:${match.ratePlanId}:${criteria.checkIn}:${criteria.checkOut}`,
    entity_module: "accommodations",
    entity_id: match.accommodationId,
    // Enough to re-resolve + reserve the owned stay via the booking handler.
    selection: {
      roomTypeId: match.roomTypeId,
      ratePlanId: match.ratePlanId,
      checkIn: criteria.checkIn,
      checkOut: criteria.checkOut,
      occupancy: match.occupancy,
    },
    // `source` is left for the fan-out to stamp as { kind: "owned", module }.
    price: match.price,
    expiresAt: match.expiresAt,
    providerData: match.providerData,
  }
}
