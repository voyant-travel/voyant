"use client"

import type { BookingDraftShape } from "@voyant-travel/catalog-contracts/booking-engine/draft-shape"

import type { BookingJourneyApiOptions } from "./use-booking-journey-api.js"

export interface UseBookingDraftShapeOptions extends BookingJourneyApiOptions {
  /** Quote response — typically passed in from the wrapping
   *  `useBookingQuote()`. */
  quote: { shape?: BookingDraftShape } | null
  /** Fallback shape rendered when the quote hasn't loaded yet — the
   *  journey shell uses this so the wizard renders an empty Configure
   *  step on first paint. */
  fallback: BookingDraftShape
}

/**
 * Convenience accessor that returns the descriptor a quote response
 * carries — or a caller-supplied fallback while we wait for the
 * first quote. Per booking-journey-architecture §3 + §8.1.
 */
export function useBookingDraftShape(options: UseBookingDraftShapeOptions): BookingDraftShape {
  return options.quote?.shape ?? options.fallback
}
