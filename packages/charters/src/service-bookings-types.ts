import type { CharterAdapter, SourceRef } from "./adapters/index.js"
import type { BookingCharterDetail } from "./booking-extension.js"
import type { PerSuiteQuote, WholeYachtQuote } from "./service-pricing.js"

export type CharterGuest = {
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

export type CharterContact = {
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

export type CreatePerSuiteBookingInput = {
  voyageId: string
  suiteId: string
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests: CharterGuest[]
  notes?: string | null
}

export type CreatePerSuiteBookingResult = {
  bookingId: string
  bookingNumber: string
  charterDetails: BookingCharterDetail
  quote: PerSuiteQuote
}

export type CreateWholeYachtBookingInput = {
  voyageId: string
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests?: CharterGuest[]
  notes?: string | null
}

export type CreateWholeYachtBookingResult = {
  bookingId: string
  bookingNumber: string
  charterDetails: BookingCharterDetail
  quote: WholeYachtQuote
}

export type CreateExternalPerSuiteBookingInput = {
  adapter: CharterAdapter
  voyageRef: SourceRef
  suiteRef: SourceRef
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests: CharterGuest[]
  notes?: string | null
}

export type CreateExternalPerSuiteBookingResult = CreatePerSuiteBookingResult & {
  sourceProvider: string
  sourceRef: SourceRef
}

export type CreateExternalWholeYachtBookingInput = {
  adapter: CharterAdapter
  voyageRef: SourceRef
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests?: CharterGuest[]
  notes?: string | null
}

export type CreateExternalWholeYachtBookingResult = CreateWholeYachtBookingResult & {
  sourceProvider: string
  sourceRef: SourceRef
}
