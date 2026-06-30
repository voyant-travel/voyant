"use client"

import { bookingDraftShapeV1 } from "@voyant-travel/catalog-contracts/booking-engine/contracts"
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
  return normalizeBookingDraftShape(options.quote?.shape, options.fallback)
}

/**
 * Quote descriptors cross adapter and JSON boundaries. Validate against the
 * public contract before rendering so a missing/malformed descriptor degrades
 * to the fallback instead of crashing when journey code reads sub-step `kind`.
 */
export function normalizeBookingDraftShape(
  shape: unknown,
  fallback: BookingDraftShape,
): BookingDraftShape {
  const shapeRecord = asRecord(shape)
  if (!shapeRecord) return fallback

  const fallbackParsed = bookingDraftShapeV1.safeParse(fallback)
  const safeFallback = fallbackParsed.success ? fallbackParsed.data : fallback
  const parsed = bookingDraftShapeV1.safeParse({
    ...safeFallback,
    ...stripMalformedSubSteps(shapeRecord),
    showsReview: true,
  })
  return parsed.success ? parsed.data : safeFallback
}

function stripMalformedSubSteps(shape: Record<string, unknown>): Record<string, unknown> {
  const accommodation = asRecord(shape.accommodation)
  return {
    ...shape,
    ...(Array.isArray(shape.configureSubSteps)
      ? {
          configureSubSteps: shape.configureSubSteps.filter(isKindedRecord),
        }
      : {}),
    ...(accommodation && Array.isArray(accommodation.subSteps)
      ? {
          accommodation: {
            ...accommodation,
            subSteps: accommodation.subSteps.filter(isKindedRecord),
          },
        }
      : {}),
  }
}

function isKindedRecord(value: unknown): value is { kind: string } {
  const record = asRecord(value)
  return typeof record?.kind === "string"
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
