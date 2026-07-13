import type { AnyDrizzleDb } from "@voyant-travel/db"

import { referenceAirports } from "../local-postgres.js"
import { EUROPE_AIRPORTS } from "./airports-europe.js"
import { GLOBAL_AIRPORTS } from "./airports-global.js"

/**
 * Seed 60 major hub airports across Europe, North America, Asia / Middle East,
 * Africa, South America, and Oceania.
 */
export async function seedAirports(db: AnyDrizzleDb): Promise<number> {
  await db.insert(referenceAirports).values(FLIGHT_REFERENCE_AIRPORTS).onConflictDoNothing()
  return FLIGHT_REFERENCE_AIRPORTS.length
}

export const FLIGHT_REFERENCE_AIRPORTS = [...EUROPE_AIRPORTS, ...GLOBAL_AIRPORTS]
