/**
 * Static-bundle `ReferenceDataProvider`.
 *
 * Even simpler than a local-Postgres provider — ship a JSON / CSV bundle
 * with the deployment, load it into memory at startup, serve from a `Map`.
 * Appropriate for small operators with stable, narrow geographic scope and
 * no need for refresh.
 *
 * No DB, no external service, no network call.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §6.2.
 */

import type {
  Aircraft,
  Airline,
  Airport,
  ReferenceDataCapabilities,
  ReferenceDataProvider,
} from "./contract.js"
import { dedupeCodes } from "./contract.js"

export interface StaticBundleReferenceData {
  airlines?: Airline[]
  airports?: Airport[]
  aircraft?: Aircraft[]
}

export interface StaticBundleProviderOptions {
  data: StaticBundleReferenceData
  /** Override capabilities; defaults are inferred from which arrays are populated. */
  capabilities?: Partial<ReferenceDataCapabilities>
}

/**
 * Build a `ReferenceDataProvider` from in-memory bundles. Maps are built
 * once at construction; lookups are O(1).
 */
export function createStaticBundleReferenceProvider(
  options: StaticBundleProviderOptions,
): ReferenceDataProvider {
  const airlines = new Map<string, Airline>()
  const airports = new Map<string, Airport>()
  const aircraft = new Map<string, Aircraft>()

  for (const airline of options.data.airlines ?? []) {
    airlines.set(airline.iataCode, airline)
  }
  for (const airport of options.data.airports ?? []) {
    airports.set(airport.iataCode, airport)
  }
  for (const ac of options.data.aircraft ?? []) {
    aircraft.set(ac.iataCode, ac)
  }

  const inferredCapabilities: ReferenceDataCapabilities = {
    coversAirlines: airlines.size > 0,
    coversAirports: airports.size > 0,
    coversAircraft: aircraft.size > 0,
    coversCurrencies: false,
    coversCountries: false,
    isReadOnly: true,
    refreshCadence: "static",
    ...options.capabilities,
  }

  return {
    capabilities: inferredCapabilities,

    async getAirline(iataCode) {
      return airlines.get(iataCode) ?? null
    },

    async getAirport(iataCode) {
      return airports.get(iataCode) ?? null
    },

    async getAircraft(iataCode) {
      return aircraft.get(iataCode) ?? null
    },

    async getAirlines(iataCodes) {
      const codes = dedupeCodes(iataCodes)
      const result = new Map<string, Airline>()
      for (const code of codes) {
        const value = airlines.get(code)
        if (value) result.set(code, value)
      }
      return result
    },

    async getAirports(iataCodes) {
      const codes = dedupeCodes(iataCodes)
      const result = new Map<string, Airport>()
      for (const code of codes) {
        const value = airports.get(code)
        if (value) result.set(code, value)
      }
      return result
    },

    async getAircraftBatch(iataCodes) {
      const codes = dedupeCodes(iataCodes)
      const result = new Map<string, Aircraft>()
      for (const code of codes) {
        const value = aircraft.get(code)
        if (value) result.set(code, value)
      }
      return result
    },
  }
}
