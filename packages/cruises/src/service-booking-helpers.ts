import type { ExternalPassengerComposition, SourceRef } from "./adapters/index.js"
import type { CruiseBookingPassenger } from "./service-booking-types.js"

export function generateCruiseBookingNumber(suffix?: string | number): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return suffix === undefined ? `CR-${ts}-${rand}` : `CR-${ts}-${rand}-${suffix}`
}

export function priceCentsFromString(s: string): number {
  // For passing to bookingsService which expects integer cents.
  // Pricing service emits decimal strings already validated to ^-?\d+(\.\d{1,2})?$
  const negative = s.startsWith("-")
  const abs = negative ? s.slice(1) : s
  const parts = abs.split(".")
  const whole = parts[0] ?? "0"
  const frac = parts[1] ?? ""
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = Number(whole) * 100 + Number(fracPadded)
  return negative ? -cents : cents
}

function passengerCompositionFromPassengers(
  passengers: CruiseBookingPassenger[],
): ExternalPassengerComposition {
  let adults = 0
  let children = 0
  let infants = 0
  let seniors = 0
  for (const passenger of passengers) {
    if (passenger.travelerCategory === "child") children += 1
    else if (passenger.travelerCategory === "infant") infants += 1
    else if (passenger.travelerCategory === "senior") seniors += 1
    else adults += 1
  }
  return { adults, children, infants, seniors }
}

export function passengerCompositionCount(composition: ExternalPassengerComposition): number {
  return (
    composition.adults +
    (composition.children ?? 0) +
    (composition.infants ?? 0) +
    (composition.seniors ?? 0)
  )
}

export function assertPassengerCompositionMatchesPassengers(
  supplied: ExternalPassengerComposition | null | undefined,
  passengers: CruiseBookingPassenger[],
): ExternalPassengerComposition {
  const inferred = passengerCompositionFromPassengers(passengers)
  if (!supplied) return inferred

  const expected = {
    adults: supplied.adults,
    children: supplied.children ?? 0,
    infants: supplied.infants ?? 0,
    seniors: supplied.seniors ?? 0,
  }
  const actual = {
    adults: inferred.adults,
    children: inferred.children ?? 0,
    infants: inferred.infants ?? 0,
    seniors: inferred.seniors ?? 0,
  }
  if (
    expected.adults !== actual.adults ||
    expected.children !== actual.children ||
    expected.infants !== actual.infants ||
    expected.seniors !== actual.seniors
  ) {
    throw new Error(
      `passengerComposition does not match passengers: composition=${JSON.stringify(
        expected,
      )} passengers=${JSON.stringify(actual)}`,
    )
  }
  if (supplied.childAges && supplied.childAges.length !== expected.children) {
    throw new Error(
      `passengerComposition.childAges length (${supplied.childAges.length}) must match children (${expected.children})`,
    )
  }
  return supplied
}

function sourceRefKey(ref: SourceRef): string {
  return JSON.stringify(sortValue(ref))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = sortValue((value as Record<string, unknown>)[key])
  }
  return out
}

export function sourceRefMatches(candidate: SourceRef, requested: SourceRef): boolean {
  if (sourceRefKey(candidate) === sourceRefKey(requested)) return true
  const candidateIsLegacy = Object.keys(candidate).length === 1
  const requestedIsLegacy = Object.keys(requested).length === 1
  return (candidateIsLegacy || requestedIsLegacy) && candidate.externalId === requested.externalId
}

export function passengerCompositionMatches(
  candidate: ExternalPassengerComposition | null | undefined,
  requested: ExternalPassengerComposition | null | undefined,
): boolean {
  if (!candidate || !requested) return true
  return (
    sourceRefKey({ externalId: "composition", ...candidate }) ===
    sourceRefKey({ externalId: "composition", ...requested })
  )
}
