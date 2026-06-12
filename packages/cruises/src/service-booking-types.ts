import type {
  CruiseAdapter,
  ExternalBookingTerms,
  ExternalFareVariant,
  ExternalPassengerComposition,
  SourceRef,
} from "./adapters/index.js"
import type { BookingCruiseDetail, BookingGroupCruiseDetail } from "./booking-extension.js"
import type { Quote } from "./service-pricing.js"

// ---------- shared shapes ----------

export type CruiseBookingPassenger = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  personId?: string | null
  isPrimary?: boolean
  notes?: string | null
}

export type CruiseBookingContact = {
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

export type CruiseBookingMode = "inquiry" | "reserve"

// ---------- single-cabin booking ----------

export type CreateCruiseBookingInput = {
  sailingId: string
  cabinCategoryId: string
  cabinId?: string | null
  occupancy: number
  fareCode?: string | null
  fareVariant?: ExternalFareVariant | null
  mode?: CruiseBookingMode
  personId?: string | null
  organizationId?: string | null
  contact: CruiseBookingContact
  passengers: CruiseBookingPassenger[]
  notes?: string | null
  /**
   * Air-arrangement intent for this cruise. The cruise booking
   * itself only carries the cabin line; the actual flight booking
   * lives in the flights vertical (or with the customer when
   * "independent"). Per booking-journey-architecture §7.
   */
  airArrangement?: "cruise_line" | "independent" | "none" | null
  /** Optional pointer to a linked flight booking when the composer
   *  ties cabin + flight lines together. */
  linkedFlightBookingId?: string | null
}

export type CreateCruiseBookingResult = {
  bookingId: string
  bookingNumber: string
  cruiseDetails: BookingCruiseDetail
  quote: Quote
}

export type CruisePartyCabinEntry = {
  cabinCategoryId: string
  cabinId?: string | null
  occupancy: number
  fareCode?: string | null
  fareVariant?: ExternalFareVariant | null
  passengers: CruiseBookingPassenger[]
  notes?: string | null
}

export type CreateCruisePartyBookingInput = {
  sailingId: string
  cabins: CruisePartyCabinEntry[]
  leadPersonId?: string | null
  organizationId?: string | null
  contact: CruiseBookingContact
  mode?: CruiseBookingMode
  label?: string
  notes?: string | null
}

export type CreateCruisePartyBookingResult = {
  groupId: string
  primaryBookingId: string | null
  groupDetails: BookingGroupCruiseDetail
  cabins: CreateCruiseBookingResult[]
}

export type CreateExternalCruiseBookingInput = {
  adapter: CruiseAdapter
  sailingRef: SourceRef
  cabinCategoryRef: SourceRef
  cabinId?: string | null
  occupancy: number
  passengerComposition?: ExternalPassengerComposition | null
  fareCode?: string | null
  fareVariant?: ExternalFareVariant | null
  mode?: CruiseBookingMode
  personId?: string | null
  organizationId?: string | null
  contact: CruiseBookingContact
  passengers: CruiseBookingPassenger[]
  bookingTerms?: ExternalBookingTerms | null
  notes?: string | null
}
