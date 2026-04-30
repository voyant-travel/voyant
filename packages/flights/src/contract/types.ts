/**
 * Flight contract types — shapes mirror voyant-cloud's `connect-flight-contract`
 * so adapters are portable across Voyant Cloud and Voyant Catalog deployments.
 *
 * These are the load-bearing data structures: `FlightSegment`, `Itinerary`,
 * `FlightOffer`, `FlightOrder`, `FlightSearchRequest`, `FlightBookRequest`,
 * the `paymentIntent` discriminated union, and the capability id namespace.
 *
 * **Drift policy:** when voyant-cloud's `connect-flight-contract` evolves,
 * mirror the additive changes here. Breaking changes flow through a
 * coordinated release across both packages.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §3.
 */

/** Cabin class. Standard IATA-aligned vocabulary. */
export type CabinClass = "economy" | "premium_economy" | "business" | "first"

/** Passenger type. Affects fare lookup and ticketing rules. */
export type PassengerType = "adult" | "child" | "infant" | "senior" | "youth"

/** Currency + amount. */
export interface Money {
  amount: string // string to preserve decimal precision
  currency: string // ISO 4217
}

/**
 * One segment of an itinerary — from departure airport to arrival airport
 * on a specific carrier + flight number.
 */
export interface FlightSegment {
  segmentId: string
  carrierCode: string // 2- or 3-char IATA carrier code
  flightNumber: string
  /** Operating carrier when different from the marketing carrier. */
  operatingCarrierCode?: string
  operatingFlightNumber?: string
  departure: {
    iataCode: string // 3-char IATA airport code
    terminal?: string
    at: string // ISO 8601 datetime with offset
  }
  arrival: {
    iataCode: string
    terminal?: string
    at: string
  }
  duration?: string // ISO 8601 duration
  aircraft?: string // IATA aircraft type code
  cabin: CabinClass
  fareClass?: string
  fareBasis?: string
  status?: string
  /** Provider-specific data — opaque round-trip. */
  providerData?: Record<string, unknown>
}

/**
 * One itinerary (journey leg) — a sequence of segments. Round-trip and
 * multi-city offers have multiple itineraries.
 */
export interface Itinerary {
  segments: FlightSegment[]
  duration?: string
}

/** Per-passenger fare breakdown line. */
export interface FareBreakdown {
  passengerType: PassengerType
  passengerCount: number
  baseFare: Money
  taxes: Money
  fees?: Money
  total: Money
  fareFamily?: string
}

/**
 * A priced flight proposition. Returned by `searchFlights`; passed back to
 * `priceOffer` and `bookFlight`. Always vertical-specific — never collapse
 * into a generic `Offer` (per architecture §1.1 and `UBIQUITOUS_LANGUAGE.md`).
 */
export interface FlightOffer {
  offerId: string
  /** Source identifier — typically the connection id or adapter slug. */
  source: string
  itineraries: Itinerary[]
  fareBreakdowns: FareBreakdown[]
  totalPrice: Money
  validatingCarrier?: string
  /** ISO 8601 — when the offer expires (provider may refuse to book after). */
  expiresAt?: string
  /** ISO 8601 — last ticketing date. */
  lastTicketingDate?: string
  instantTicketing?: boolean
  /** Provider-specific data — opaque round-trip. */
  providerData?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One slice of a search request. Slice count determines trip type:
 *   - 1 slice  → one-way
 *   - 2 slices → round-trip
 *   - 3+       → multi-city / open-jaw
 */
export interface FlightSlice {
  origin: string // 3-char IATA
  destination: string
  departureDate: string // ISO date
  departureTimeWindow?: { earliest?: string; latest?: string }
}

export interface PassengerCounts {
  adults: number
  children?: number
  infants?: number
}

export interface FlightSearchRequest {
  slices: FlightSlice[]
  passengers: PassengerCounts
  cabin?: CabinClass
  searchOptions?: {
    directOnly?: boolean
    maxStops?: number
    minConnectionMinutes?: number
    includeCarriers?: string[]
    excludeCarriers?: string[]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intent-driven booking — caller declares what they want, system honors
 * or rejects per the adapter's declared capabilities. Default if omitted:
 * `{ type: "hold" }`.
 */
export type PaymentIntent =
  | { type: "hold" }
  | { type: "card"; token: string; cardholderName?: string; billingAddress?: BillingAddress }
  | { type: "ticket_on_credit"; iataCode?: string }

export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode?: string
  countryCode: string
}

export interface FlightPassenger {
  passengerId: string
  type: PassengerType
  givenNames: string
  surname: string
  birthDate: string // ISO date
  gender?: "M" | "F" | "X"
  email?: string
  phone?: string
  documents?: TravelDocument[]
}

export interface TravelDocument {
  type: "passport" | "national_id" | "visa"
  number: string
  countryOfIssue: string
  countryOfNationality?: string
  expiryDate?: string
}

export interface FlightBookRequest {
  offerId: string
  /** Provider-specific re-priced offer payload, when the adapter requires it. */
  offer?: FlightOffer
  passengers: FlightPassenger[]
  contact?: { email?: string; phone?: string }
  paymentIntent?: PaymentIntent // default: { type: "hold" }
}

export type FlightOrderStatus =
  | "pending"
  | "confirmed" // held; awaiting ticketing
  | "ticketed"
  | "cancelled"
  | "failed"

export interface FlightTicket {
  ticketNumber: string
  passengerId: string
  segmentIds: string[]
  status?: string
}

export interface FlightOrder {
  orderId: string
  /** PNR / record locator. */
  pnr?: string
  status: FlightOrderStatus
  offer: FlightOffer
  passengers: FlightPassenger[]
  contact?: { email?: string; phone?: string }
  tickets?: FlightTicket[]
  totalPrice: Money
  /** ISO 8601 — deadline before the hold expires (held orders only). */
  paymentDeadline?: string
  createdAt: string
  updatedAt?: string
  /** Provider-specific data — opaque round-trip. */
  providerData?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability ids
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capability ids declared per connection. Adapters that don't declare a
 * capability stub the corresponding method with `CAPABILITY_NOT_SUPPORTED`.
 */
export const FLIGHT_CAPABILITIES = {
  HOLDS: "flight/holds",
  SEATMAP: "flight/seatmap",
  SEAT_SELECTION: "flight/seat-selection",
  ANCILLARIES: "flight/ancillaries",
  CHECKIN: "flight/checkin",
  EXCHANGE: "flight/exchange",
  REFUND: "flight/refund",
  VOID: "flight/void",
  SSR: "flight/ssr",
  BRANDED_FARES: "flight/branded-fares",
} as const

export type FlightCapability = (typeof FLIGHT_CAPABILITIES)[keyof typeof FLIGHT_CAPABILITIES]
