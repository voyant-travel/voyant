/**
 * Catalog detail enrichment client.
 *
 * Mirrors `createCatalogBookingFetchers` (quote/book) — provides a
 * first-class factory for the `/v1/admin/products/:id/content` URL the
 * detail sheet expects, so hosts no longer hand-roll `onLoadProductDetail`
 * for the common case and can't accidentally point at a route that isn't
 * mounted.
 *
 * The server side of this contract is `createProductContentRoutes` from
 * `@voyantjs/products/routes-content`. If a host mounts `CatalogPage`
 * with `enrichmentFetchers` but forgets the server mount, the first 404
 * triggers a one-time `console.warn` pointing at the docs — fast feedback
 * on the foot-gun called out in issue #1023.
 */

import type { CatalogSearchHit } from "@voyantjs/catalog-react"

import type { CatalogDetailEnrichment } from "./catalog-detail-sheet.js"

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

interface ContentResponseEnvelope {
  data: {
    content: SourcedContentPayload
    served_locale: string
    match_kind: "exact" | "language_match" | "fallback_chain" | "any"
    source: "sourced-cache" | "sourced-fresh" | "synthesized" | "owned"
    served_stale: boolean
    synthesized: boolean
    machine_translated: boolean
  }
}

type SourcedContentPayload = ProductContentPayload | CruiseContentPayload

interface ProductContentPayload {
  product: {
    id: string
    name: string
    description?: string | null
    highlights?: string[]
    hero_image_url?: string | null
    duration_days?: number | null
    sell_currency?: string | null
    supplier?: string | null
    country?: string | null
  }
  options: Array<{ id: string; name: string; description?: string | null }>
  days: Array<{
    day_number: number
    title?: string | null
    description?: string | null
    location?: string | null
    hero_image_url?: string | null
  }>
  media: Array<{ url: string; type: string; caption?: string | null }>
  policies: Array<{ kind: string; body: string }>
  departures?: Array<{
    id: string
    starts_at: string
    ends_at?: string | null
    status?: string | null
    capacity?: number | null
    remaining?: number | null
    lowest_price_cents?: number | null
    currency?: string | null
    note?: string | null
  }>
}

interface CruiseContentPayload {
  cruise: {
    id: string
    name: string
    description?: string | null
    highlights?: string[]
    hero_image_url?: string | null
    cruise_line?: string | null
  }
  ship?: {
    id?: string | null
    name: string
    ship_type?: string | null
    description?: string | null
    deck_plan_url?: string | null
    deck_plans?: Array<{
      name: string
      level?: number | null
      image_url?: string | null
    }>
    capacity?: number | null
    decks?: number | null
    year_built?: number | null
    gallery?: string[]
  } | null
  sailings?: Array<{
    id: string
    source_ref?: string | null
    start_date: string
    end_date: string
    duration_nights?: number | null
    status?: string | null
    embarkation_port?: string | null
    disembarkation_port?: string | null
    itinerary_stops?: CruiseItineraryStopPayload[]
    lowest_price_cents: number | null
    currency: string | null
  }>
  cabin_categories?: Array<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    type?: string | null
    images?: string[]
    floorplan_images?: string[]
    square_feet?: string | null
    grade_codes?: string[]
    wheelchair_accessible?: boolean
    capacity_max?: number | null
    inclusions?: string[]
  }>
  itinerary_stops?: CruiseItineraryStopPayload[]
  policies: Array<{ kind: string; body: string }>
}

interface CruiseItineraryStopPayload {
  day_number: number
  port_name: string
  description?: string | null
  date?: string | null
  arrival_time?: string | null
  departure_time?: string | null
  is_at_sea?: boolean | null
}

let warnedAboutMissingMount = false

/**
 * Build a `CatalogEnrichmentFetchers` for the configured `baseUrl`.
 * Symmetric with `createCatalogBookingFetchers`.
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
        `createProductContentRoutes from @voyantjs/products/routes-content ` +
        `under the same prefix used here.`,
    )
  }
}

function mapContentToEnrichment(
  payload: ContentResponseEnvelope,
  availability: Map<string, CatalogSlotAvailability>,
  formatSupplier?: (id: string) => string,
): CatalogDetailEnrichment {
  const {
    content,
    served_locale,
    match_kind,
    source,
    served_stale,
    synthesized,
    machine_translated,
  } = payload.data
  const base = isCruiseContent(content)
    ? mapCruiseContentToEnrichment(content)
    : mapProductContentToEnrichment(content, availability, formatSupplier)

  return {
    ...base,
    servedLocale: served_locale,
    matchKind: match_kind,
    source,
    servedStale: served_stale,
    synthesized,
    machineTranslated: machine_translated,
  }
}

function isCruiseContent(content: SourcedContentPayload): content is CruiseContentPayload {
  return "cruise" in content
}

function mapProductContentToEnrichment(
  content: ProductContentPayload,
  availability: Map<string, CatalogSlotAvailability>,
  formatSupplier?: (id: string) => string,
): CatalogDetailEnrichment {
  const supplierName =
    typeof content.product.supplier === "string"
      ? formatSupplier
        ? formatSupplier(content.product.supplier)
        : content.product.supplier
      : (content.product.supplier ?? null)

  return {
    description: content.product.description ?? null,
    highlights: content.product.highlights ?? [],
    heroImageUrl: content.product.hero_image_url ?? null,
    supplier: supplierName,
    itinerary: content.days.map((d) => ({
      dayNumber: d.day_number,
      title: d.title ?? null,
      description: d.description ?? null,
      location: d.location ?? null,
      heroImageUrl: d.hero_image_url ?? null,
    })),
    media: content.media.map((m) => ({
      url: m.url,
      type: m.type,
      caption: m.caption ?? null,
    })),
    options: content.options.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description ?? null,
    })),
    policies: content.policies.map((p) => ({ kind: p.kind, body: p.body })),
    departures: (content.departures ?? []).map((d) => {
      const slot = availability.get(d.id)
      return {
        id: d.id,
        startsAt: d.starts_at,
        endsAt: d.ends_at ?? null,
        status: slot?.status ?? d.status ?? null,
        unlimited: slot?.unlimited ?? null,
        capacity: slot?.initialPax ?? d.capacity ?? null,
        remaining: slot?.remainingPax ?? d.remaining ?? null,
        lowestPriceCents: d.lowest_price_cents ?? null,
        currency: d.currency ?? null,
        note: d.note ?? null,
      }
    }),
  }
}

function mapCruiseContentToEnrichment(content: CruiseContentPayload): CatalogDetailEnrichment {
  return {
    description: content.cruise.description ?? null,
    highlights: content.cruise.highlights ?? [],
    heroImageUrl: content.cruise.hero_image_url ?? null,
    supplier: content.cruise.cruise_line ?? null,
    ship: content.ship
      ? {
          id: content.ship.id ?? null,
          name: content.ship.name,
          shipType: content.ship.ship_type ?? null,
          description: content.ship.description ?? null,
          deckPlanUrl: content.ship.deck_plan_url ?? null,
          deckPlans: (content.ship.deck_plans ?? []).map((deck) => ({
            name: deck.name,
            level: deck.level ?? null,
            imageUrl: deck.image_url ?? null,
          })),
          capacity: content.ship.capacity ?? null,
          decks: content.ship.decks ?? null,
          yearBuilt: content.ship.year_built ?? null,
          images: content.ship.gallery ?? [],
        }
      : null,
    // Cruise itinerary lives per-sailing in the content payload; the cruise-level
    // `itinerary_stops` is empty for sourced cruises. Fall back to the first
    // sailing's stops so the Itinerary tab shows the representative route.
    itinerary: mapCruiseItineraryStops(
      content.itinerary_stops?.length
        ? content.itinerary_stops
        : (content.sailings?.[0]?.itinerary_stops ?? []),
    ),
    media: [],
    options: (content.cabin_categories ?? []).map((c) => ({
      id: c.id,
      name: formatCruiseCabinCategoryName(c),
      description: c.description ? stripHtmlTags(c.description) : null,
      code: c.code ?? null,
      type: c.type ?? null,
      images: c.images ?? [],
      floorplanImages: c.floorplan_images ?? [],
      squareFeet: c.square_feet ?? null,
      gradeCodes: c.grade_codes ?? [],
      wheelchairAccessible: c.wheelchair_accessible ?? false,
      capacityMax: c.capacity_max ?? null,
      amenities: c.inclusions ?? [],
    })),
    policies: content.policies.map((p) => ({ kind: p.kind, body: p.body })),
    departures: (content.sailings ?? []).map((s) => ({
      id: s.id,
      sourceRef: s.source_ref ?? null,
      startsAt: s.start_date,
      endsAt: s.end_date,
      durationNights: s.duration_nights ?? null,
      status: s.status ?? null,
      embarkationPort: s.embarkation_port ?? null,
      disembarkationPort: s.disembarkation_port ?? null,
      lowestPriceCents: s.lowest_price_cents,
      currency: s.currency,
      itinerary: mapCruiseItineraryStops(s.itinerary_stops ?? []),
    })),
  }
}

function mapCruiseItineraryStops(
  stops: ReadonlyArray<CruiseItineraryStopPayload>,
): NonNullable<CatalogDetailEnrichment["itinerary"]> {
  return stops.map((d) => ({
    dayNumber: d.day_number,
    title: d.port_name,
    description: d.description ?? null,
    location: d.port_name,
    date: d.date ?? null,
    arrivalTime: d.arrival_time ?? null,
    departureTime: d.departure_time ?? null,
    isAtSea: d.is_at_sea ?? null,
  }))
}

function formatCruiseCabinCategoryName(category: {
  code?: string | null
  name: string
  type?: string | null
}): string {
  // Upstream cabin names occasionally arrive wrapped in HTML (e.g. Viking sends
  // `<p>Deluxe Veranda Stateroom (DV)</p>`); strip it so it never renders raw.
  const name = stripHtmlTags(category.name).trim()
  const code = category.code?.trim()
  if (!name) return code ?? category.type ?? ""
  // Grade rows where the upstream has no distinct display name come through as
  // name === code; show just the code instead of "DV2 - DV2".
  if (code && code !== name) return `${code} - ${name}`
  return name
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
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
