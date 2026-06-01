/**
 * Canonical-geography name resolver backed by Voyant Data geo
 * (`@voyantjs/data-sdk`, `/data/geo/v1`). Turns canonical place ids
 * (`city:geonames:745044`, `region:europe`, `river:Q1653`) into localized
 * display names ("Istanbul", "Europe", "Danube").
 *
 * Used at cruise-sourcing time to fill the projection's `ports` / `regions` /
 * `waterways` name arrays when the upstream only carried ids — so the catalog
 * shows resolved names, not raw ids. Results are memoized per id (place names
 * are stable), so a sync only pays one request per distinct place.
 */

import { createVoyantDataClient } from "@voyantjs/data-sdk"

export interface GeoNameResolver {
  /** Resolve ids to display names, preserving order, dropping misses, deduped. */
  resolveMany(ids: ReadonlyArray<string>): Promise<string[]>
}

export interface GeoNameResolverOptions {
  apiKey: string
  /** Voyant Cloud base URL; defaults to the SDK's `https://api.voyantjs.com`. */
  baseUrl?: string
  /** BCP 47 language for resolved names. Defaults to `en`. */
  lang?: string
}

export function createGeoNameResolver(options: GeoNameResolverOptions): GeoNameResolver {
  const client = createVoyantDataClient({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    lang: options.lang ?? "en",
  })
  // Cache the in-flight promise so concurrent lookups of the same id share one
  // request.
  const cache = new Map<string, Promise<string | null>>()

  const resolveOne = (id: string): Promise<string | null> => {
    const cached = cache.get(id)
    if (cached) return cached
    const pending = client.geo.places
      .get(id)
      .then((res: { data?: { name?: string | null } }) =>
        typeof res?.data?.name === "string" ? res.data.name : null,
      )
      .catch(() => null)
    cache.set(id, pending)
    return pending
  }

  return {
    async resolveMany(ids) {
      const names = await Promise.all(ids.map(resolveOne))
      const seen = new Set<string>()
      const out: string[] = []
      for (const name of names) {
        if (name && !seen.has(name)) {
          seen.add(name)
          out.push(name)
        }
      }
      return out
    },
  }
}
