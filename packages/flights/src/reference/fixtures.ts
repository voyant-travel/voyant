import type { AnyDrizzleDb } from "@voyant-travel/db"

import { FLIGHT_REFERENCE_AIRCRAFT, seedAircraft } from "./fixtures/aircraft.js"
import { FLIGHT_REFERENCE_AIRLINES, seedAirlines } from "./fixtures/airlines.js"
import { FLIGHT_REFERENCE_AIRPORTS, seedAirports } from "./fixtures/airports.js"

export { FLIGHT_REFERENCE_AIRCRAFT, FLIGHT_REFERENCE_AIRLINES, FLIGHT_REFERENCE_AIRPORTS }

export interface FlightReferenceFixtureCounts {
  aircraft: number
  airlines: number
  airports: number
}

/** Insert the package-owned reference fixture with conflict-safe semantics. */
export async function seedFlightReferenceFixtures(
  db: AnyDrizzleDb,
): Promise<FlightReferenceFixtureCounts> {
  const airlines = await seedAirlines(db)
  const airports = await seedAirports(db)
  const aircraft = await seedAircraft(db)
  return { aircraft, airlines, airports }
}
