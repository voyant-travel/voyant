/**
 * Catalog detail enrichment — the normalized detail view-model
 * (`CatalogDetailEnrichment`) + the client that fetches a single entity's rich
 * content from the catalog content service and maps it into that shape.
 *
 * Provides a first-class factory for the
 * `/v1/admin/{products,cruises,accommodations}/:id/content` URLs the detail
 * sheet expects, so hosts no longer hand-roll `onLoadProductDetail` for the
 * common case and can't accidentally point at a route that isn't mounted.
 *
 * The server side of this contract is `createProductContentRoutes` from
 * `@voyant-travel/inventory`. If a host mounts `CatalogPage` with
 * `enrichmentFetchers` but forgets the server mount, the first 404 triggers a
 * one-time `console.warn` pointing at the docs — fast feedback on the foot-gun
 * called out in issue #1023.
 */

import {
  type ContentResponseEnvelope,
  mapContentToEnrichment,
} from "./catalog-enrichment-mappers.js"
import type { CatalogSearchHit } from "./schemas.js"

/**
 * Rich detail enrichment loaded on-demand when the sheet opens.
 * Fetched separately from the search index — the index keeps a lean
 * facetable projection; the enrichment carries everything else via the
 * catalog content service (description, itinerary, media, options,
 * policies, supplier).
 */
export interface CatalogDetailEnrichment {
  /** Entity display name from the content source (header on the full-page view). */
  name?: string | null
  description?: string | null
  shortDescription?: string | null
  highlights?: ReadonlyArray<string>
  heroImageUrl?: string | null
  supplier?: string | null
  /** The vessel a cruise sails on (Ship tab). */
  ship?: {
    id?: string | null
    name: string
    shipType?: string | null
    description?: string | null
    deckPlanUrl?: string | null
    deckPlans?: Array<{
      name: string
      level?: number | null
      imageUrl?: string | null
    }>
    capacity?: number | null
    decks?: number | null
    yearBuilt?: number | null
    images?: string[]
  } | null
  itinerary?: ReadonlyArray<{
    dayNumber: number
    title?: string | null
    description?: string | null
    location?: string | null
    date?: string | null
    arrivalTime?: string | null
    departureTime?: string | null
    isAtSea?: boolean | null
    /** Optional hero image rendered alongside the day card. */
    heroImageUrl?: string | null
  }>
  media?: ReadonlyArray<{ url: string; type?: string; caption?: string | null }>
  options?: ReadonlyArray<{
    id: string
    name: string
    description?: string | null
    code?: string | null
    type?: string | null
    images?: string[]
    floorplanImages?: string[]
    squareFeet?: string | null
    gradeCodes?: string[]
    wheelchairAccessible?: boolean
    capacityMax?: number | null
    amenities?: string[]
  }>
  policies?: ReadonlyArray<{ kind: string; body: string }>
  departures?: ReadonlyArray<{
    id: string
    sourceRef?: string | null
    startsAt: string
    endsAt?: string | null
    durationNights?: number | null
    status?: string | null
    embarkationPort?: string | null
    disembarkationPort?: string | null
    unlimited?: boolean | null
    capacity?: number | null
    remaining?: number | null
    lowestPriceCents?: number | null
    currency?: string | null
    note?: string | null
    itinerary?: ReadonlyArray<{
      dayNumber: number
      title?: string | null
      description?: string | null
      location?: string | null
      date?: string | null
      arrivalTime?: string | null
      departureTime?: string | null
      isAtSea?: boolean | null
    }>
  }>
  /** Resolution metadata — drives the chips at the top. */
  servedLocale?: string
  matchKind?: string
  source?: string
  servedStale?: boolean
  synthesized?: boolean
  machineTranslated?: boolean
}

export interface CatalogEnrichmentFetchers {
  /**
   * Fetch the rich detail enrichment for a single hit. Returns `null`
   * when the server has no content row (404 / 503) — the sheet falls
   * back to the bare indexed projection.
   *
   * `vertical` selects the content route when `contentBasePathByVertical`
   * is configured (e.g. cruises read `/v1/admin/cruises/:id/content`,
   * not the products route). Returns `null` for verticals with no
   * configured content route so the sheet renders the projection only.
   */
  loadProductDetail: (
    hit: CatalogSearchHit,
    vertical?: string,
  ) => Promise<CatalogDetailEnrichment | null>
  /**
   * Fetch live per-cabin pricing for one sailing (cruises). Called lazily when
   * a departure row expands — pricing is volatile-live, so it's never cached in
   * the detail enrichment. Returns `null` when unavailable (non-cruise vertical,
   * no sailing ref, or the adapter can't price).
   */
  loadDeparturePricing: (
    hit: CatalogSearchHit,
    sailingRef: string,
    vertical?: string,
  ) => Promise<CatalogDeparturePricingRow[] | null>
}

/** One live per-cabin price row for a cruise sailing. */
export interface CatalogDeparturePricingRow {
  cabinExternalId: string
  occupancy: number
  fareCode: string | null
  fareName: string | null
  currency: string
  /** Major-unit price string as the adapter returns it (e.g. "12959.00"). */
  pricePerPerson: string
  availability: string
}

export interface CatalogEnrichmentFetchersOptions {
  /** Base URL the content route lives under, e.g. `/api` or `https://operator.example/api`. */
  baseUrl: string
  /**
   * Hono-mount path for `createProductContentRoutes`. Defaults to
   * `/v1/admin/products` — the operator mount. Public surfaces typically
   * pass `/v1/public/products`.
   */
  contentBasePath?: string
  /**
   * Per-vertical content mount paths, e.g.
   * `{ products: "/v1/admin/products", cruises: "/v1/admin/cruises" }`.
   * When set, the detail loader routes by the hit's vertical: a vertical
   * present in the map fetches from its path; a vertical absent from the
   * map skips the fetch (returns `null`) so the sheet shows the projection
   * only — avoiding a spurious request to the products route. When unset,
   * every fetch uses `contentBasePath` (legacy single-vertical behavior).
   */
  contentBasePathByVertical?: Record<string, string>
  fetch?: typeof globalThis.fetch
  credentials?: RequestCredentials
  /**
   * Resolves supplier ids to display names. The server returns the
   * supplier as an id string; the sheet shows the resolved name. When
   * omitted, the id is passed through unchanged.
   */
  formatSupplier?: (id: string) => string
  /** Optional locale forwarded as `?locale=...` (BCP 47). */
  locale?: string
  /** Optional market id forwarded as `?market=...`. */
  market?: string
  /**
   * Optional per-departure availability loader. When provided, the
   * fetcher merges runtime availability (status / remaining / capacity)
   * onto each departure in the result. Mirrors the operator's existing
   * call to `/v1/admin/catalog/slots`.
   */
  loadSlotAvailability?: (productId: string) => Promise<Map<string, CatalogSlotAvailability>>
}

export interface CatalogSlotAvailability {
  id: string
  startsAt?: string
  status?: string | null
  unlimited?: boolean | null
  remainingPax?: number | null
  initialPax?: number | null
}

let warnedAboutMissingMount = false

/**
 * Build a `CatalogEnrichmentFetchers` for the configured `baseUrl`.
 */
export function createCatalogEnrichmentFetchers(
  options: CatalogEnrichmentFetchersOptions,
): CatalogEnrichmentFetchers {
  const {
    baseUrl,
    contentBasePath = "/v1/admin/products",
    contentBasePathByVertical,
    fetch: fetchImpl = globalThis.fetch,
    credentials = "include",
    formatSupplier,
    locale,
    market,
    loadSlotAvailability,
  } = options

  const root = trimTrailingSlash(baseUrl)
  const defaultBasePath = ensureLeadingSlash(contentBasePath)

  // Resolve the content mount for a vertical. Returns null when a per-vertical
  // map is configured but this vertical has no entry (so callers skip the fetch
  // rather than hitting the products route with a foreign id, which 404s).
  const resolveBasePath = (vertical?: string): string | null => {
    if (!contentBasePathByVertical) return defaultBasePath
    if (!vertical) return null
    const mapped = contentBasePathByVertical[vertical]
    return mapped ? ensureLeadingSlash(mapped) : null
  }

  const loadProductDetail = async (
    hit: CatalogSearchHit,
    vertical?: string,
  ): Promise<CatalogDetailEnrichment | null> => {
    const basePath = resolveBasePath(vertical)
    if (!basePath) return null
    const url = buildContentUrl(root, basePath, hit.id, { locale, market })
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials,
      })
    } catch (err) {
      throw new Error(
        `catalog enrichment fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    if (response.status === 404 || response.status === 503) {
      // 404 ALSO means the server didn't mount `createProductContentRoutes`.
      // Warn once so the foot-gun called out in #1023 surfaces in dev
      // instead of silently rendering the bare projection.
      maybeWarnMissingMount(response, url)
      return null
    }
    if (!response.ok) {
      throw new Error(`catalog enrichment fetch failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as ContentResponseEnvelope
    const availability = loadSlotAvailability
      ? // i18n-literal-ok: `=> new Map<…>` trips the JSX-text heuristic — no user-facing copy here.
        await loadSlotAvailability(hit.id).catch(() => new Map<string, CatalogSlotAvailability>())
      : new Map<string, CatalogSlotAvailability>()
    return mapContentToEnrichment(payload, availability, formatSupplier)
  }

  const loadDeparturePricing = async (
    hit: CatalogSearchHit,
    sailingRef: string,
    vertical?: string,
  ): Promise<CatalogDeparturePricingRow[] | null> => {
    const basePath = resolveBasePath(vertical)
    if (!basePath) return null
    const url = `${root}${basePath}/${encodeURIComponent(hit.id)}/sailings/${encodeURIComponent(
      sailingRef,
    )}/pricing`
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials,
      })
    } catch {
      return null
    }
    if (!response.ok) return null
    const payload = (await response.json()) as { data?: { pricing?: CatalogDeparturePricingRow[] } }
    return payload.data?.pricing ?? null
  }

  return { loadProductDetail, loadDeparturePricing }
}

function maybeWarnMissingMount(response: Response, url: string): void {
  if (warnedAboutMissingMount) return
  if (response.status !== 404) return
  // Heuristic: a 404 returned with no JSON body almost always means the
  // route is unmounted on the server side. A real "product not found"
  // response carries a JSON `{ error: "not_found", detail }`. We don't
  // re-read the body here (the caller will not parse it for 404), so we
  // log a generic hint — false positives are tolerable in dev.
  warnedAboutMissingMount = true
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[catalog-ui] enrichment fetch returned 404 for ${url}. ` +
        `If the catalog detail sheet renders empty, make sure the host mounts ` +
        `createProductContentRoutes from @voyant-travel/inventory ` +
        `under the same prefix used here.`,
    )
  }
}

function buildContentUrl(
  root: string,
  basePath: string,
  id: string,
  query: { locale?: string; market?: string },
): string {
  const params = new URLSearchParams()
  if (query.locale) params.set("locale", query.locale)
  if (query.market) params.set("market", query.market)
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ""
  return `${root}${basePath}/${encodeURIComponent(id)}/content${suffix}`
}

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s
}

function ensureLeadingSlash(s: string): string {
  return s.startsWith("/") ? s : `/${s}`
}

/** @internal — exported for testing. Resets the one-time warn flag. */
export function __resetEnrichmentFetcherWarnings(): void {
  warnedAboutMissingMount = false
}
