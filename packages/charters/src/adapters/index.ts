/**
 * Adapter contract for external charter inventory.
 *
 * The charters module supports both self-managed products (operator owns the
 * data) and external products (a registered adapter sits between Voyant and an
 * upstream system — Voyant Connect, an in-house broker engine, a per-brand
 * sync). External products are reached through a registered CharterAdapter.
 *
 * Unlike cruises, charters has NO search index. The operator universe is small
 * (six brands in v1) so list endpoints fan out to all registered adapters at
 * request time. Templates that don't power a customer storefront still benefit
 * from listing — admin browse is the primary read.
 *
 * See docs/architecture/charters-module.md §10 for the full design.
 */

// ---------- pointers + provenance ----------

/**
 * Opaque pointer back to the adapter's upstream identifier(s) for a product,
 * voyage, suite, or yacht. Adapters may store any extra fields they need
 * (connection IDs, vendor-specific codes, snapshot timestamps).
 */
export type SourceRef = {
  connectionId?: string
  externalId: string
  [key: string]: unknown
}

// ---------- canonical external shapes ----------
// These mirror the local charters schema fields the UI renders. Adapters return
// them; the route layer hands them to the client with `source: 'external'` and
// the originating provider/sourceRef so the UI can render the External badge.

export type ExternalCharterProduct = {
  sourceRef: SourceRef
  name: string
  slug: string
  lineName: string
  defaultYachtRef?: SourceRef | null
  description?: string | null
  shortDescription?: string | null
  heroImageUrl?: string | null
  mapImageUrl?: string | null
  regions?: string[]
  themes?: string[]
  status?: "draft" | "awaiting_review" | "live" | "archived"
  /** Booking modes the product offers by default; per-voyage entries can override. */
  defaultBookingModes?: Array<"per_suite" | "whole_yacht">
  /** Typical APA % for this brand (e.g. "27.50"). Per-voyage may override. */
  defaultApaPercent?: string | null
  /**
   * Local (Voyant-side) reference to the MYBA contract template for whole-yacht
   * bookings. The adapter returns a slug or template id that the operator has
   * pre-created in `legal.contractTemplates`. Per-voyage may override.
   */
  defaultMybaTemplateRef?: string | null
}

export type ExternalCharterVoyage = {
  sourceRef: SourceRef
  productRef: SourceRef
  yachtRef: SourceRef
  voyageCode: string
  name?: string | null
  embarkPortName?: string | null
  disembarkPortName?: string | null
  departureDate: string // ISO YYYY-MM-DD
  returnDate: string
  nights: number
  bookingModes: Array<"per_suite" | "whole_yacht">
  appointmentOnly?: boolean

  /**
   * Whole-yacht pricing — only relevant when 'whole_yacht' in bookingModes.
   * `{ "<ISO-4217>": "<numeric-string>" }` map. Adapters can publish any
   * subset of currencies; consumers ask for the one they need at quote time.
   */
  wholeYachtPricesByCurrency?: Record<string, string>

  apaPercentOverride?: string | null
  mybaTemplateRefOverride?: string | null
  charterAreaOverride?: string | null

  salesStatus?: "open" | "on_request" | "wait_list" | "sold_out" | "closed"
  availabilityNote?: string | null
}

export type ExternalCharterSuite = {
  sourceRef: SourceRef
  voyageRef: SourceRef
  suiteCode: string
  suiteName: string
  suiteCategory?: "standard" | "deluxe" | "suite" | "penthouse" | "owners" | "signature" | null
  description?: string | null
  squareFeet?: string | null
  images?: string[]
  floorplanImages?: string[]
  maxGuests?: number | null

  /**
   * Per-currency suite price map. Adapters can publish any subset of
   * currencies (e.g. `{ USD: "1500.00", EUR: "1380.00" }`); consumers
   * resolve the one they need at quote time.
   */
  pricesByCurrency?: Record<string, string>

  /**
   * Optional per-currency port fee map, separate from the suite price.
   * Same shape as `pricesByCurrency`.
   */
  portFeesByCurrency?: Record<string, string>

  availability: "available" | "limited" | "on_request" | "wait_list" | "sold_out"
  unitsAvailable?: number | null
  appointmentOnly?: boolean
  notes?: string | null

  /** Per-brand quirks that don't fit the canonical schema. */
  extra?: Record<string, unknown>
}

export type ExternalCharterScheduleDay = {
  dayNumber: number
  portName?: string | null
  scheduleDate?: string | null
  arrivalTime?: string | null
  departureTime?: string | null
  isSeaDay?: boolean
  description?: string | null
  activities?: string[]
}

export type ExternalCharterYacht = {
  sourceRef: SourceRef
  name: string
  slug: string
  yachtClass: "luxury_motor" | "luxury_sailing" | "expedition" | "small_cruise"
  capacityGuests?: number | null
  capacityCrew?: number | null
  lengthMeters?: string | null
  yearBuilt?: number | null
  yearRefurbished?: number | null
  imo?: string | null
  description?: string | null
  gallery?: string[]
  amenities?: Record<string, unknown>
  crewBios?: Array<{ role: string; name: string; bio?: string; photoUrl?: string }>
  defaultCharterAreas?: string[]
}

// ---------- list page (admin browse) ----------

export type ExternalCharterProductSummary = {
  sourceRef: SourceRef
  name: string
  slug: string
  lineName: string
  yachtName?: string | null
  earliestVoyage?: string | null
  latestVoyage?: string | null
  /**
   * Lowest published per-suite price for the deployment's chosen browse
   * currency. The adapter is free to compute this in any currency it
   * publishes — `lowestPriceCurrency` records which one. UI hides the
   * price when the adapter doesn't publish anything in that currency.
   */
  lowestPriceAmount?: string | null
  lowestPriceCurrency?: string | null
  heroImageUrl?: string | null
}

export type ListEntriesOptions = {
  since?: Date
  cursor?: string
  limit?: number
}

export type ListEntriesResult = {
  entries: ExternalCharterProductSummary[]
  nextCursor?: string
}

// ---------- booking commit ----------

export type ExternalGuestInput = {
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

export type CreateExternalPerSuiteBookingInput = {
  voyageRef: SourceRef
  suiteRef: SourceRef
  currency: string
  guests: ExternalGuestInput[]
  contact: ExternalContactInput
  notes?: string | null
}

export type CreateExternalWholeYachtBookingInput = {
  voyageRef: SourceRef
  currency: string
  guests?: ExternalGuestInput[]
  contact: ExternalContactInput
  notes?: string | null
}

/**
 * Common shape for upstream booking commits. Adapters return the upstream
 * confirmation reference + an optional final-pricing snapshot in case the
 * upstream resolved the price differently from what we composed locally
 * (last-minute adjustments, etc.).
 */
export type ExternalBookingResult = {
  /** Upstream confirmation reference (broker booking id, vendor PNR, etc.). */
  connectorBookingRef: string
  /** Upstream-side status string for display. */
  connectorStatus?: string | null

  // Optional final-pricing snapshots — adapters set the relevant one based on
  // the booking type the route called. Routes prefer these over the locally-
  // composed quote when present.

  // per_suite mode
  finalSuitePrice?: string | null
  finalPortFee?: string | null

  // whole_yacht mode
  finalCharterFee?: string | null
  finalApaPercent?: string | null
  finalApaAmount?: string | null

  /** Final total — always provided by the adapter when set; route uses it as
      the authoritative booking sell amount. */
  finalTotal?: string | null
  finalCurrency?: string | null
}

// ---------- the contract itself ----------

export interface CharterAdapter {
  readonly name: string
  readonly version: string

  /** Catalog browse — backs admin list. Charter adapters paginate via cursor. */
  listEntries(options?: ListEntriesOptions): Promise<ListEntriesResult>

  // Detail reads — called from admin and public when resolving an external key.
  fetchProduct(sourceRef: SourceRef): Promise<ExternalCharterProduct | null>
  fetchVoyage(sourceRef: SourceRef): Promise<ExternalCharterVoyage | null>
  fetchVoyageSuites(sourceRef: SourceRef): Promise<ExternalCharterSuite[]>
  fetchVoyageSchedule(sourceRef: SourceRef): Promise<ExternalCharterScheduleDay[]>
  fetchYacht(sourceRef: SourceRef): Promise<ExternalCharterYacht | null>

  /**
   * Voyages on a given external product — used by `GET /v1/admin/charters/products/:key/voyages`
   * when the key is external.
   */
  listVoyagesForProduct(productRef: SourceRef): Promise<ExternalCharterVoyage[]>

  /**
   * Per-suite booking commit. Adapter returns the upstream confirmation ref
   * + an optional final price snapshot. Throws on upstream error so the
   * caller's transaction rolls back.
   */
  createPerSuiteBooking(input: CreateExternalPerSuiteBookingInput): Promise<ExternalBookingResult>

  /**
   * Whole-yacht booking commit. Same contract — throws on upstream error.
   * Note that even external whole-yacht bookings still require a Voyant-side
   * MYBA contract template; the adapter just returns the upstream
   * confirmation, the local route layer handles MYBA generation separately.
   */
  createWholeYachtBooking(
    input: CreateExternalWholeYachtBookingInput,
  ): Promise<ExternalBookingResult>
}

export type AdapterCallContext = { adapterName: string; method: string }
