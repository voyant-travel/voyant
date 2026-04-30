/**
 * Itinerary fingerprint — deterministic key derived from a `FlightOffer`'s
 * segments. Two providers selling the same flight produce identical
 * fingerprints; the multi-connection fan-out uses this to merge offers
 * across connections.
 *
 * Mirrors voyant-cloud's `itineraryFingerprint` so fingerprints are
 * portable: an offer fingerprinted in voyant-cloud and another fingerprinted
 * here for the same physical flight match by string equality.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §4.
 */

import type { FlightOffer } from "../contract/types.js"

/**
 * Deterministic key derived from segments: carrier code + flight number +
 * departure/arrival airports + times + cabin. Two providers selling the
 * same flight produce identical fingerprints.
 */
export function itineraryFingerprint(offer: FlightOffer): string {
  return offer.itineraries
    .flatMap((itinerary) =>
      itinerary.segments.map(
        (s) =>
          `${s.carrierCode}${s.flightNumber}|${s.departure.iataCode}|${s.departure.at}|${s.arrival.iataCode}|${s.arrival.at}|${s.cabin}`,
      ),
    )
    .join("→")
}
