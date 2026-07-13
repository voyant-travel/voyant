import type { referenceAirports } from "../local-postgres.js"

export type AirportFixtureRow = typeof referenceAirports.$inferInsert
