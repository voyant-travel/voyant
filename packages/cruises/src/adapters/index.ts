/**
 * Adapter contract for external cruise inventory.
 *
 * The cruises module is a storage + service + routes layer for both self-managed
 * and external cruises. External cruises live entirely in an upstream system
 * (Voyant Connect, a custom agency adapter, etc.) and are reached through a
 * registered adapter that implements this contract.
 *
 * The contract is deliberately small. Templates default to the Voyant Connect
 * adapter; agencies that prefer their own connectivity engine register a custom
 * implementation instead. See docs/architecture/cruises-module.md §10.
 */

import type { Quote, QuoteComponent } from "../service-pricing.js"

// ---------- pointers + provenance ----------

/**
 * Opaque pointer back to the adapter's upstream identifier(s) for a cruise,
 * sailing, ship, or cabin category. Adapters may store any extra fields they
 * need (connection IDs, vendor-specific codes, snapshot timestamps).
 */
export type SourceRef = {
  connectionId?: string
  externalId: string
  [key: string]: unknown
}

// ---------- canonical external shapes ----------
// These mirror the local cruises schema fields the UI renders. Adapters return
// them; the route layer hands them to the client with `source: 'external'` and
// the originating provider/sourceRef so the UI can render the External badge.

export type ExternalCruise = {
  sourceRef: SourceRef
  name: string
  slug: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  defaultShipRef?: SourceRef
  nights: number
  embarkPortName?: string | null
  disembarkPortName?: string | null
  description?: string | null
  shortDescription?: string | null
  highlights?: string[]
  inclusionsHtml?: string | null
  exclusionsHtml?: string | null
  regions?: string[]
  themes?: string[]
  heroImageUrl?: string | null
  mapImageUrl?: string | null
  status?: "draft" | "awaiting_review" | "live" | "archived"
}

export type ExternalSailing = {
  sourceRef: SourceRef
  cruiseRef: SourceRef
  shipRef: SourceRef
  departureDate: string // ISO YYYY-MM-DD
  returnDate: string
  embarkPortName?: string | null
  disembarkPortName?: string | null
  direction?: "upstream" | "downstream" | "round_trip" | "one_way" | null
  availabilityNote?: string | null
  isCharter?: boolean
  salesStatus?: "open" | "on_request" | "wait_list" | "sold_out" | "closed"
}

export type ExternalShip = {
  sourceRef: SourceRef
  name: string
  slug: string
  shipType: "ocean" | "river" | "expedition" | "yacht" | "sailing" | "coastal"
  capacityGuests?: number | null
  capacityCrew?: number | null
  cabinCount?: number | null
  deckCount?: number | null
  lengthMeters?: string | null
  cruisingSpeedKnots?: string | null
  yearBuilt?: number | null
  yearRefurbished?: number | null
  imo?: string | null
  description?: string | null
  deckPlanUrl?: string | null
  gallery?: string[]
  amenities?: Record<string, unknown>
  decks?: ExternalDeck[]
  categories?: ExternalCabinCategory[]
}

export type ExternalDeck = {
  name: string
  level?: number | null
  planImageUrl?: string | null
}

export type ExternalCabinCategory = {
  sourceRef: SourceRef
  code: string
  name: string
  roomType: "inside" | "oceanview" | "balcony" | "suite" | "penthouse" | "single"
  description?: string | null
  minOccupancy: number
  maxOccupancy: number
  squareFeet?: string | null
  wheelchairAccessible?: boolean
  amenities?: string[]
  images?: string[]
  floorplanImages?: string[]
  gradeCodes?: string[]
}

export type ExternalPriceRow = {
  sourceRef?: SourceRef
  cabinCategoryRef: SourceRef
  occupancy: number
  fareCode?: string | null
  fareCodeName?: string | null
  currency: string
  pricePerPerson: string
  secondGuestPricePerPerson?: string | null
  singleSupplementPercent?: string | null
  availability: "available" | "limited" | "on_request" | "wait_list" | "sold_out"
  availabilityCount?: number | null
  bookingDeadline?: string | null // ISO date
  requiresRequest?: boolean
  notes?: string | null
  components?: ExternalPriceComponent[]
}

export type ExternalPriceComponent = {
  kind:
    | "gratuity"
    | "onboard_credit"
    | "port_charge"
    | "tax"
    | "ncf"
    | "airfare"
    | "transfer"
    | "insurance"
  label?: string | null
  amount: string
  currency: string
  direction: "addition" | "inclusion" | "credit"
  perPerson: boolean
}

export type ExternalItineraryDay = {
  dayNumber: number
  title?: string | null
  description?: string | null
  portName?: string | null
  arrivalTime?: string | null
  departureTime?: string | null
  isOvernight?: boolean
  isSeaDay?: boolean
  isExpeditionLanding?: boolean
  meals?: { breakfast?: boolean; lunch?: boolean; dinner?: boolean }
}

// ---------- search projection (for cruise_search_index, phase 4) ----------

export type CruiseSearchProjectionEntry = {
  sourceRef: SourceRef
  slug: string
  name: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  shipName: string
  nights: number
  embarkPortName?: string | null
  disembarkPortName?: string | null
  regions?: string[]
  themes?: string[]
  earliestDeparture?: string | null
  latestDeparture?: string | null
  lowestPrice?: string | null
  lowestPriceCurrency?: string | null
  salesStatus?: string | null
  heroImageUrl?: string | null
}

// ---------- list page (for admin browse + storefront) ----------

export type ExternalCruiseSummary = {
  sourceRef: SourceRef
  name: string
  slug: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  shipName?: string
  nights: number
  earliestDeparture?: string | null
  lowestPrice?: string | null
  lowestPriceCurrency?: string | null
  heroImageUrl?: string | null
}

export type ListEntriesOptions = {
  since?: Date
  cursor?: string
  limit?: number
}

export type ListEntriesResult = {
  entries: ExternalCruiseSummary[]
  nextCursor?: string
}

// ---------- booking commit ----------

export type ExternalPassengerInput = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  isPrimary?: boolean
}

export type ExternalContactInput = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  language?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
}

export type CreateExternalBookingInput = {
  sailingRef: SourceRef
  cabinCategoryRef: SourceRef
  occupancy: number
  fareCode?: string | null
  passengers: ExternalPassengerInput[]
  contact: ExternalContactInput
  notes?: string | null
}

export type ExternalBookingResult = {
  /** Upstream confirmation reference (e.g. cruise-line PNR, vendor booking id). */
  connectorBookingRef: string
  /** Upstream-side status string for display. */
  connectorStatus?: string | null
  /** Final quote as resolved by the upstream — used to refresh the local snapshot
      in case of any minor adjustments (e.g. last-minute promo expiry). */
  finalQuote?: Quote
  /** Optional snapshot components to override the locally-composed list. */
  finalComponents?: QuoteComponent[]
}

// ---------- the contract itself ----------

export interface CruiseAdapter {
  readonly name: string
  readonly version: string

  /**
   * Catalog browse — backs admin list and the storefront list once it's wired
   * to read external entries (phase 4 will run searchProjection in the background
   * to keep cruise_search_index hot; admin can call this at request time).
   */
  listEntries(options?: ListEntriesOptions): Promise<ListEntriesResult>

  /**
   * Slim projection stream for storefront search-index population (phase 4).
   * Default no-op-iter implementations are fine for adapters that don't power
   * a customer-facing storefront.
   */
  searchProjection(options?: ListEntriesOptions): AsyncIterable<CruiseSearchProjectionEntry>

  // Detail reads — called from admin and storefront when resolving an external key.
  fetchCruise(sourceRef: SourceRef): Promise<ExternalCruise | null>
  fetchSailing(sourceRef: SourceRef): Promise<ExternalSailing | null>
  fetchSailingPricing(sourceRef: SourceRef): Promise<ExternalPriceRow[]>
  fetchSailingItinerary(sourceRef: SourceRef): Promise<ExternalItineraryDay[]>
  fetchShip(sourceRef: SourceRef): Promise<ExternalShip | null>

  /**
   * Sailings on a given external cruise, used by GET /v1/admin/cruises/:key/sailings
   * when the key is external.
   */
  listSailingsForCruise(cruiseRef: SourceRef): Promise<ExternalSailing[]>

  /**
   * Booking commit. Returns the upstream confirmation reference + a final quote
   * snapshot that the local booking row stores in booking_cruise_details.
   * Throws on upstream errors so the caller's transaction rolls back.
   */
  createBooking(input: CreateExternalBookingInput): Promise<ExternalBookingResult>
}

export type AdapterCallContext = { adapterName: string; method: string }

// ---------- catalog SourceAdapter shim ----------

export {
  type CruiseSourceAdapterShim,
  type CruiseSourceAdapterShimOptions,
  cruiseAdapterToSourceAdapter,
  cruiseItineraryStopFrom,
} from "./source-adapter-shim.js"
