import type { CruiseDay, CruiseSailingDay } from "./schema-itinerary.js"

export type EffectiveItineraryDay = {
  dayNumber: number
  title: string | null
  description: string | null
  portFacilityId: string | null
  portCanonicalPlaceId: string | null
  arrivalTime: string | null
  departureTime: string | null
  isOvernight: boolean
  isSeaDay: boolean
  isExpeditionLanding: boolean
  isSkipped: boolean
  meals: { breakfast?: boolean; lunch?: boolean; dinner?: boolean }
  hasOverride: boolean
}

export function mergeDay(
  base: CruiseDay,
  override: CruiseSailingDay | undefined,
): EffectiveItineraryDay {
  if (!override) {
    return {
      dayNumber: base.dayNumber,
      title: base.title,
      description: base.description,
      portFacilityId: base.portFacilityId,
      portCanonicalPlaceId: base.portCanonicalPlaceId,
      arrivalTime: base.arrivalTime,
      departureTime: base.departureTime,
      isOvernight: base.isOvernight,
      isSeaDay: base.isSeaDay,
      isExpeditionLanding: base.isExpeditionLanding,
      isSkipped: false,
      meals: base.meals ?? {},
      hasOverride: false,
    }
  }
  return {
    dayNumber: base.dayNumber,
    title: override.title ?? base.title,
    description: override.description ?? base.description,
    portFacilityId: override.portFacilityId ?? base.portFacilityId,
    portCanonicalPlaceId: override.portCanonicalPlaceId ?? base.portCanonicalPlaceId,
    arrivalTime: override.arrivalTime ?? base.arrivalTime,
    departureTime: override.departureTime ?? base.departureTime,
    isOvernight: override.isOvernight ?? base.isOvernight,
    isSeaDay: override.isSeaDay ?? base.isSeaDay,
    isExpeditionLanding: override.isExpeditionLanding ?? base.isExpeditionLanding,
    isSkipped: override.isSkipped,
    meals: override.meals ?? base.meals ?? {},
    hasOverride: true,
  }
}
