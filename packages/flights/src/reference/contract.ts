/**
 * `ReferenceDataProvider` contract — swappable provider for global
 * reference data (airlines, airports, aircraft, currencies, countries).
 *
 * Per architecture §5.11.6 / §6, implementable at any layer:
 *   - **In-deployment local Postgres** (the simplest case)
 *   - Static JSON / CSV bundle
 *   - Internal data lake / warehouse
 *   - Third-party services (OAG, Cirium, RouteHappy)
 *   - GDS-bundled reference subscriptions
 *   - Voyant Data (the hosted default)
 *
 * No implementer is privileged. Operators can run a fully self-contained
 * Voyant deployment with all reference data in their own database, no
 * external dependency.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §6.
 */

export interface Airline {
  iataCode: string // 2- or 3-char IATA
  icaoCode?: string // 3-char ICAO
  name: string
  /** ISO 3166-1 alpha-2 country code. */
  country?: string
  /** Optional logo URL. */
  logoUrl?: string
  /** Optional alliance affiliation: `"oneworld"`, `"star-alliance"`, `"skyteam"`. */
  alliance?: string
}

export interface Airport {
  iataCode: string // 3-char IATA
  icaoCode?: string // 4-char ICAO
  name: string
  city: string
  /** ISO 3166-1 alpha-2. */
  country: string
  timezone?: string // IANA tz database name
  latitude?: number
  longitude?: number
}

export interface Aircraft {
  iataCode: string // e.g. "738"
  icaoCode?: string // e.g. "B738"
  name: string // "Boeing 737-800"
  manufacturer?: string
  /** Optional capacity hint (typical seat count). */
  typicalSeats?: number
}

/**
 * Capabilities declared by the provider. Lets the catalog plane fail
 * fast when a deployment requests reference data the provider can't
 * serve (e.g. asking for currencies from a provider that only covers
 * airlines/airports).
 */
export interface ReferenceDataCapabilities {
  coversAirlines: boolean
  coversAirports: boolean
  coversAircraft: boolean
  coversCurrencies: boolean
  coversCountries: boolean
  /** True for hosted/read-only providers; false for ones that allow upserts. */
  isReadOnly: boolean
  /** How often the provider's data refreshes from upstream. */
  refreshCadence: "static" | "weekly" | "daily" | "on-demand"
}

/**
 * The reference data contract. Used by flight integrations to hydrate
 * IATA codes into human-readable names + metadata; usable by any other
 * vertical that needs the same lookup surface.
 */
export interface ReferenceDataProvider {
  readonly capabilities: ReferenceDataCapabilities

  /** Look up one airline by IATA code. Returns null if not found. */
  getAirline(iataCode: string): Promise<Airline | null>

  /** Look up one airport by IATA code. */
  getAirport(iataCode: string): Promise<Airport | null>

  /** Look up one aircraft type by IATA code. */
  getAircraft(iataCode: string): Promise<Aircraft | null>

  /** Batch lookup — preferred for hydrating offers / orders with many codes. */
  getAirlines(iataCodes: string[]): Promise<Map<string, Airline>>
  getAirports(iataCodes: string[]): Promise<Map<string, Airport>>
  getAircraftBatch(iataCodes: string[]): Promise<Map<string, Aircraft>>
}

/**
 * Helper that hydrates a batch of distinct IATA codes once and returns a
 * Map. Used internally by providers that fetch from a slow upstream and
 * want to serve repeated lookups from an in-memory cache.
 */
export function dedupeCodes(codes: string[]): string[] {
  return Array.from(new Set(codes.filter((c) => c.length > 0)))
}
