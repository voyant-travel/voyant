/**
 * Project a `HospitalityContent` payload into a `BookingDraftShape`.
 *
 * Hotel / room-type bookings need:
 *   - Configure: date-range (check-in → check-out) + occupancy.
 *   - Accommodation: room selection — the journey's
 *     `accommodation.subSteps` rooms variant, populated from
 *     `content.room_types[]`.
 *   - Add-ons: meal plans + amenities surfaced as upsells (when the
 *     supplier prices them as add-ons; otherwise they're informational).
 *
 * Pricing flows through liveResolve at quote time per night /
 * occupancy / rate-plan.
 */

import {
  type BookingDraftShape,
  defaultBookingFields,
  defaultDraftShapeFlags,
  defaultTravelerFields,
  type PaxBandSpec,
  paxBandsAllowedTotalFrom,
  type RoomOption,
} from "@voyantjs/catalog/booking-engine"

import type { HospitalityContent } from "./content-shape.js"

export const DEFAULT_HOSPITALITY_PAX_BANDS: ReadonlyArray<PaxBandSpec> = [
  { code: "adult", label: "Adult", minCount: 1, maxCount: 6 },
  { code: "child", label: "Child", minAge: 0, maxAge: 17, minCount: 0, maxCount: 4 },
]

export interface BuildHospitalityDraftShapeOptions {
  locale?: string
  paxBands?: ReadonlyArray<PaxBandSpec>
  paxBandsAllowedTotal?: { min: number; max: number }
  /**
   * Default minimum-nights window. Most bedbanks accept 1–30 nights;
   * templates override per supplier when known.
   */
  minNights?: number
  maxNights?: number
  /** When true, the wizard allows multiple guests sharing one room. */
  sharedRoomAllowed?: boolean
}

export function buildHospitalityDraftShape(
  content: HospitalityContent,
  options: BuildHospitalityDraftShapeOptions = {},
): BookingDraftShape {
  const paxBands = options.paxBands ?? DEFAULT_HOSPITALITY_PAX_BANDS
  const total = options.paxBandsAllowedTotal ?? paxBandsAllowedTotalFrom(paxBands)
  const minNights = options.minNights ?? 1
  const maxNights = options.maxNights ?? 30
  const sharedRoomAllowed = options.sharedRoomAllowed ?? true

  const roomOptions: RoomOption[] = content.room_types.map((rt) => ({
    id: rt.id,
    name: rt.name,
    description: rt.description ?? null,
    capacity: rt.max_occupancy ?? rt.max_adults ?? null,
    baseRateHint: null,
  }))

  return {
    ...defaultDraftShapeFlags(),
    showsAccommodation: roomOptions.length > 0,
    paxBands,
    paxBandsAllowedTotal: total,
    travelerFields: defaultTravelerFields(),
    bookingFields: defaultBookingFields(),
    configureSubSteps: [
      { kind: "date-range", minNights, maxNights },
      { kind: "occupancy", bands: paxBands },
    ],
    accommodation:
      roomOptions.length > 0
        ? {
            roomOptions,
            sharedRoomAllowed,
            subSteps: [
              {
                kind: "rooms",
                options: roomOptions,
                sharedRoomAllowed,
              },
            ],
          }
        : undefined,
    paymentIntents: ["hold", "card"],
  }
}
