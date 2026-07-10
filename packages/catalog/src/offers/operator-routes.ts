/**
 * Live package/cruise offer routes — owned by `@voyant-travel/catalog`.
 *
 * agent-quality: file-size exception -- Live offer routes keep search, detail,
 * and pricing adapter normalization together until the route is split by
 * provider surface.
 *
 *   POST /v1/admin/catalog/package-offers
 *   POST /v1/admin/catalog/package-detail
 *   POST /v1/admin/catalog/package-search
 *   POST /v1/admin/catalog/departure-airports
 *   POST /v1/admin/catalog/cruise-price
 *   POST /v1/admin/catalog/cruise-sailing-pricing
 *
 * Sourced packages (TUI) are synced into the catalog as a priced *summary*
 * (the cards). The actual bookable units — departure dates, room/board, flights
 * and per-departure prices — are **live**: they come from Voyant Connect's
 * `packages/search`, not from static content. The connect-sdk doesn't wrap that
 * endpoint yet, so we call it through the client transport.
 *
 * Given a catalog product id, we resolve its connection + upstream
 * accommodation ref from `catalog_sourced_entries`, then fan the search out and
 * return the offers mapped to a lean, render-ready shape. The call is live, so
 * it can 5xx (TUI staging) — we retry once and fail soft with an empty list.
 *
 * Deployment-specific access (Voyant Connect client construction, the Typesense
 * hero-field lookup, and destination-name resolution) is INJECTED via options
 * so this package never statically imports connect-sdk / typesense / geo. The
 * handlers only call the structural surface the deployment hands them.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { catalogSourcedEntriesTable } from "../schema-sourced-entries.js"

// ─────────────────────────────────────────────────────────────────
// Injected deployment surface (structural — no connect-sdk/typesense/geo import)
// ─────────────────────────────────────────────────────────────────

/**
 * The structural subset of the Voyant Connect client the offer handlers call.
 * The deployment builds the real client (from its env) and hands back this
 * shape; the package never imports `@voyant-travel/connect-sdk`.
 */
export interface CatalogOffersConnectClient {
  transport: {
    request(
      path: string,
      init: { method: string; body?: unknown; unwrapData?: boolean },
    ): Promise<unknown>
  }
  accommodations: {
    getOnConnection(
      connectionId: string,
      externalId: string,
      options?: { locale?: string },
    ): Promise<unknown>
  }
  cruises: {
    getOnConnection(connectionId: string, externalId: string): Promise<unknown>
    listSailingPricing(connectionId: string, sailingRef: string): Promise<unknown[]>
  }
}

/** Hero/index fields the offer cards enrich from (mirrors the Typesense doc). */
export interface CatalogOffersIndexFields {
  name?: string
  thumbnailUrl?: string
  stars?: string | number
  destinations?: string[]
  countryCodes?: string[]
}

/** A resolved departure airport, code + friendly label. */
export interface CatalogOffersAirportLabel {
  code: string
  label: string
}

/** A destination filter for the live search / airport probe. */
export interface CatalogOffersSearchDestination {
  countryCode?: string
  region?: string
  city?: string
  destinationCodes?: string[]
}

/**
 * Deployment-supplied options for the catalog offer route module. Structural
 * only — the three injected functions encapsulate every connect-sdk / typesense
 * / geo access so the package stays free of those static imports.
 */
export interface CatalogOffersRouteModuleOptions {
  /**
   * Build the Voyant Connect client for this request, or return `null` when
   * Connect isn't configured (missing api key / operator id). When `null`, the
   * handlers fall back to the "connect_not_configured" empty-list responses.
   */
  resolveConnectClient(c: Context): CatalogOffersConnectClient | null
  /**
   * Resolve product ids → their indexed hero fields (Typesense). Best-effort;
   * the deployment owns the typesense call and returns an empty map on failure.
   */
  fetchIndexFields(c: Context, productIds: string[]): Promise<Map<string, CatalogOffersIndexFields>>
  /**
   * Resolve a destination → its dynamic (live-composable) catalog hotel ids
   * from the deployment's search index, capped to `limit`. Empty array when the
   * index isn't configured.
   */
  resolveDynamicHotelIds(
    c: Context,
    destination: CatalogOffersSearchDestination,
    limit: number,
  ): Promise<string[]>
  /**
   * Resolve departure airport codes (OTP, IAS…) to "City (CODE)" labels. Must
   * never throw — falls back to the bare code on any error.
   */
  resolveAirportLabels(c: Context, codes: string[]): Promise<CatalogOffersAirportLabel[]>
}

// ─────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  productId: z.string().min(1),
  departureDateFrom: z.string().min(1),
  departureDateTo: z.string().min(1),
  nights: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .optional(),
  adults: z.number().int().min(1).default(2),
  children: z.number().int().min(0).optional(),
  childrenAges: z.array(z.number().int().min(0)).optional(),
  boards: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(200).optional(),
})

// Individual product page: full accommodation detail + rich content (gallery,
// descriptions, rooms, reviews) + dated offers. `locale` requests a content
// language (Connect falls back to any synced locale).
const detailSchema = bodySchema.extend({ locale: z.string().optional() })

// Cruise from-price lookup (the content route carries no price).
const cruisePriceSchema = z.object({ cruiseId: z.string().min(1) })

// Live per-cabin pricing for one sailing (Connect `listSailingPricing`).
const cruiseSailingPricingSchema = z.object({
  cruiseId: z.string().min(1),
  sailingRef: z.string().min(1),
})

const airportsSchema = z.object({
  destination: z.object({
    countryCode: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    destinationCodes: z.array(z.string()).optional(),
  }),
  nights: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .optional(),
})

const searchSchema = z.object({
  destination: z.object({
    countryCode: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    destinationCodes: z.array(z.string()).optional(),
  }),
  departureDateFrom: z.string().min(1),
  departureDateTo: z.string().min(1),
  nights: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .optional(),
  adults: z.number().int().min(1).default(2),
  children: z.number().int().min(0).optional(),
  childrenAges: z.array(z.number().int().min(0)).optional(),
  boards: z.array(z.string()).optional(),
  minStars: z.number().positive().optional(),
  maxPriceMinor: z.number().int().positive().optional(),
  currency: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
})

// ─────────────────────────────────────────────────────────────────
// Tuning constants
// ─────────────────────────────────────────────────────────────────

// Most TUI sun packages are 7-night; without a duration the offers API 400s.
const DEFAULT_NIGHTS = { min: 7, max: 7 }
// Bound the live fan-out: enough hotels for a representative calendar without
// hammering TUI's (flaky) offers API on every search.
const MAX_HOTELS = 45
const HOTELS_PER_CALL = 15
const MAX_OFFERS = 600
// Departure-airport probe scope — a handful of hotels is enough to surface the
// destination's departure airports without a heavy fan-out.
const AIRPORT_PROBE_HOTELS = 8

// ─────────────────────────────────────────────────────────────────
// OpenAPI route + response schemas (voyant#2114 / voyant#2208)
//
// The live offer/search payloads are heterogeneous upstream (TUI) shapes the
// handlers map to lean render objects, so the documented 200 schemas are
// deliberately permissive (open objects with `z.unknown()` offer rows). Request
// bodies stay validated IN-HANDLER (each handler `safeParse`s the real
// `bodySchema`/`detailSchema`/… below and owns its custom 400 / soft-200
// fallbacks), so the declared request body is an opaque pass-through — the
// catalog precedent for heterogeneous offer payloads.
// ─────────────────────────────────────────────────────────────────

/**
 * Deployment `Variables` the offer handlers read off the request context — the
 * parent app's middleware chain resolves `db`. Permissive: the handlers cast to
 * `PostgresJsDatabase` for the sourced-entry lookups.
 */
type Env = { Variables: { db?: AnyDrizzleDb } }

const offerErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
})

const airportLabelSchema = z.object({ code: z.string(), label: z.string() })

const packageOffersResponseSchema = z.object({
  product: z.unknown().nullish(),
  offers: z.array(z.unknown()),
  retryable: z.boolean().optional(),
  error: z.string().optional(),
})

const packageDetailResponseSchema = z.object({
  product: z.unknown().nullish(),
  offers: z.array(z.unknown()),
  retryable: z.boolean().optional(),
  source: z.object({ connectionId: z.string(), ref: z.string().nullable() }).optional(),
  error: z.string().optional(),
})

const packageSearchResponseSchema = z.object({
  offers: z.array(z.unknown()),
  departureAirports: z.array(airportLabelSchema).optional(),
  currency: z.string().optional(),
  sampledHotels: z.number().optional(),
  retryable: z.boolean().optional(),
  error: z.string().optional(),
})

const departureAirportsResponseSchema = z.object({
  departureAirports: z.array(airportLabelSchema),
})

const cruisePriceResponseSchema = z.object({
  fromAmountMinor: z.number().nullable(),
  currency: z.string().nullable(),
})

const cruiseSailingPricingResponseSchema = z.object({
  cabins: z.array(
    z.object({ code: z.string(), fromAmountMinor: z.number(), available: z.boolean() }),
  ),
  currency: z.string().nullable(),
  retryable: z.boolean().optional(),
})

/** Opaque JSON request body — each handler validates the real schema in-line. */
const opaqueJsonBody = {
  required: false,
  content: { "application/json": { schema: z.unknown() } },
} as const

const packageOffersRoute = createRoute({
  method: "post",
  path: "/package-offers",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Live dated offers for one accommodation (+ hero fields), or a soft fallback",
      content: { "application/json": { schema: packageOffersResponseSchema } },
    },
    400: {
      description: "invalid_request — body failed validation",
      content: { "application/json": { schema: offerErrorSchema } },
    },
  },
})

const packageDetailRoute = createRoute({
  method: "post",
  path: "/package-detail",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Full accommodation detail + live offers + resolved provenance",
      content: { "application/json": { schema: packageDetailResponseSchema } },
    },
    400: {
      description: "invalid_request — body failed validation",
      content: { "application/json": { schema: offerErrorSchema } },
    },
  },
})

const packageSearchRoute = createRoute({
  method: "post",
  path: "/package-search",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Cheapest live offer per (hotel, date, origin) across a destination",
      content: { "application/json": { schema: packageSearchResponseSchema } },
    },
    400: {
      description: "invalid_request — body failed validation",
      content: { "application/json": { schema: offerErrorSchema } },
    },
  },
})

const departureAirportsRoute = createRoute({
  method: "post",
  path: "/departure-airports",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Distinct departure airports for a destination (soft-empty on any failure)",
      content: { "application/json": { schema: departureAirportsResponseSchema } },
    },
  },
})

const cruisePriceRoute = createRoute({
  method: "post",
  path: "/cruise-price",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Cruise-level from-price from the Connect summary (nulls when unavailable)",
      content: { "application/json": { schema: cruisePriceResponseSchema } },
    },
    400: {
      description: "invalid_request — body failed validation",
      content: { "application/json": { schema: offerErrorSchema } },
    },
  },
})

const cruiseSailingPricingRoute = createRoute({
  method: "post",
  path: "/cruise-sailing-pricing",
  request: { body: opaqueJsonBody },
  responses: {
    200: {
      description: "Cheapest available price per cabin for one sailing in a single currency",
      content: { "application/json": { schema: cruiseSailingPricingResponseSchema } },
    },
    400: {
      description: "invalid_request — body failed validation",
      content: { "application/json": { schema: offerErrorSchema } },
    },
  },
})

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

/**
 * The catalog admin offer routes (relative paths; mount at
 * `/v1/admin/catalog`). All connect/typesense/geo access is injected via
 * `options`. Migrated to `@hono/zod-openapi` for the admin OpenAPI backfill
 * (voyant#2114) — the handlers keep returning a plain `Response`, bridged to the
 * inferred typed-response union by `asRouteResponse`.
 */
export function createCatalogOffersAdminRoutes(
  options: CatalogOffersRouteModuleOptions,
): OpenAPIHono<Env> {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(packageOffersRoute, (c) => asRouteResponse(handlePackageOffers(c, options)))
    .openapi(packageDetailRoute, (c) => asRouteResponse(handlePackageDetail(c, options)))
    .openapi(packageSearchRoute, (c) => asRouteResponse(handlePackageSearch(c, options)))
    .openapi(departureAirportsRoute, (c) => asRouteResponse(handleDepartureAirports(c, options)))
    .openapi(cruisePriceRoute, (c) => asRouteResponse(handleCruisePrice(c, options)))
    .openapi(cruiseSailingPricingRoute, (c) =>
      asRouteResponse(handleCruiseSailingPricing(c, options)),
    )
}

/** Package-owned descriptor for deployments that inject catalog offer providers. */
export function createCatalogOffersHonoExtension(
  options: CatalogOffersRouteModuleOptions,
): HonoExtension {
  return {
    extension: { name: "catalog-offers", module: "catalog" },
    adminRoutes: createCatalogOffersAdminRoutes(options),
  }
}

/**
 * Bridge a handler's plain `Promise<Response>` to the typed-response shape
 * `.openapi()` infers per route. The runtime value already honors the declared
 * schemas; this only relaxes the compile-time union.
 */
// biome-ignore lint/suspicious/noExplicitAny: intentional — bridges bare Response to the inferred typed-response union (voyant#2114)
function asRouteResponse(response: Promise<Response>): Promise<any> {
  return response
}

// ─────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────

async function handlePackageOffers(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.issues }, 400)
  }
  const input = parsed.data

  const client = options.resolveConnectClient(c)
  if (!client) {
    return c.json({ error: "connect_not_configured", offers: [] }, 200)
  }

  // Resolve the connection + upstream accommodation ref for this product.
  const db = c.get("db") as PostgresJsDatabase
  const [entry] = await db
    .select({
      connectionId: catalogSourcedEntriesTable.source_connection_id,
      sourceRef: catalogSourcedEntriesTable.source_ref,
    })
    .from(catalogSourcedEntriesTable)
    .where(eq(catalogSourcedEntriesTable.entity_id, input.productId))
    .limit(1)

  const connectionId = entry?.connectionId
  // Upstream accommodation id is the catalog id without its source prefix
  // ("tui-pkg:AYT61172" → "AYT61172"). `source_ref` stores the full catalog
  // id, so strip the prefix from whichever we use.
  const accommodationId = (entry?.sourceRef ?? input.productId).replace(/^[^:]+:/, "")
  if (!connectionId) {
    return c.json({ error: "no_connection_for_product", offers: [] }, 200)
  }

  const { offers, retryable } = await fetchLiveOffers(client, connectionId, accommodationId, input)
  if (retryable && offers.length === 0) {
    return c.json({ error: "offers_unavailable", offers: [], retryable: true }, 200)
  }
  // Include the product's indexed hero fields so the in-sheet section can
  // render header + calendar from a single call. (The full-page detail uses
  // `package-detail`, which reads the real record from Connect.)
  const idx = await options.fetchIndexFields(c, [input.productId])
  const product = idx.get(input.productId) ?? null
  return c.json({ product, offers: offers.map(mapOffer), retryable })
}

// ── Individual product page — full detail, fetched from the SOURCE ───────
// The detail page is NOT a search read. It point-reads the accommodation
// (name, stars, location, gallery, descriptions, rooms, reviews) directly
// from Connect via `getOnConnection(connectionId, externalId, { locale })` —
// both ids come from `catalog_sourced_entries` — plus the live dated offers.
async function handlePackageDetail(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = detailSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.issues }, 400)
  }
  const input = parsed.data
  const client = options.resolveConnectClient(c)
  if (!client) {
    return c.json({ error: "connect_not_configured", product: null, offers: [] }, 200)
  }

  const db = c.get("db") as PostgresJsDatabase
  const [entry] = await db
    .select({
      sourceKind: catalogSourcedEntriesTable.source_kind,
      connectionId: catalogSourcedEntriesTable.source_connection_id,
      sourceRef: catalogSourcedEntriesTable.source_ref,
    })
    .from(catalogSourcedEntriesTable)
    .where(eq(catalogSourcedEntriesTable.entity_id, input.productId))
    .limit(1)
  const connectionId = entry?.connectionId
  const accommodationId = (entry?.sourceRef ?? input.productId).replace(/^[^:]+:/, "")
  if (!connectionId) {
    return c.json({ error: "no_connection_for_product", product: null, offers: [] }, 200)
  }

  // Accommodation detail + rich content, direct from Connect (best-effort —
  // offers still render if it fails).
  let product: ReturnType<typeof mapAccommodationDetail> | null = null
  try {
    const detail = await client.accommodations.getOnConnection(connectionId, accommodationId, {
      ...(input.locale ? { locale: input.locale } : {}),
    })
    product = mapAccommodationDetail(detail as Record<string, unknown>)
  } catch {
    // Detail unavailable; the page still shows the calendar + offers.
  }

  // One accommodation, many dates × rooms × boards — request the max so the
  // calendar + per-room meal options aren't truncated by the default cap.
  const { offers, retryable } = await fetchLiveOffers(client, connectionId, accommodationId, {
    ...input,
    limit: input.limit ?? 200,
  })
  // Return the resolved provenance so the booking journey can pin the exact
  // Connect connection — without it the server falls back to the first adapter
  // for the kind, which quotes/books the wrong connection when several are live.
  return c.json({
    product,
    offers: offers.map(mapOffer),
    retryable,
    source: { kind: entry?.sourceKind ?? null, connectionId, ref: entry?.sourceRef ?? null },
  })
}

// ── Destination search (search-first Dynamic surface) ───────────────────
// Live offers across a destination's hotels over a date window. Returns the
// cheapest offer per (hotel, departure date) so the UI can render both an
// availability calendar (offers/from-price per day) and per-day hotel cards.
//
// Critical wiring (see catalog-supply-models.md + the de-risk memo):
//   1. Resolve the hotel set from OUR Typesense index, gated to
//      `supplyModel:=dynamic` + the chosen country — this excludes the
//      scheduled connections (Uniworld/Viking) that can't do packages/search.
//   2. Call packages/search with `accommodationIds` (proven 200), grouped by
//      the hotels' own connection.
//   3. Always send `nights` — TUI's offers API 400s without it.
async function handlePackageSearch(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = searchSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.issues }, 400)
  }
  const input = parsed.data
  const client = options.resolveConnectClient(c)
  const currencyFallback = input.currency ?? "EUR"
  if (!client) {
    return c.json({ error: "connect_not_configured", offers: [] }, 200)
  }

  // 1) Resolve the dynamic hotels for this destination from our own index.
  const hotelIds = await options.resolveDynamicHotelIds(c, input.destination, MAX_HOTELS)
  if (hotelIds.length === 0) {
    return c.json({ offers: [], currency: currencyFallback, sampledHotels: 0, retryable: false })
  }

  // 2) Map catalog ids → upstream accommodationId, grouped by connection.
  const db = c.get("db") as PostgresJsDatabase
  const entries = await db
    .select({
      entityId: catalogSourcedEntriesTable.entity_id,
      connectionId: catalogSourcedEntriesTable.source_connection_id,
      sourceRef: catalogSourcedEntriesTable.source_ref,
    })
    .from(catalogSourcedEntriesTable)
    .where(inArray(catalogSourcedEntriesTable.entity_id, hotelIds))
  const byConnection = new Map<string, string[]>()
  for (const entry of entries) {
    if (!entry.connectionId) continue
    const accId = (entry.sourceRef ?? entry.entityId).replace(/^[^:]+:/, "")
    const list = byConnection.get(entry.connectionId) ?? []
    list.push(accId)
    byConnection.set(entry.connectionId, list)
  }
  if (byConnection.size === 0) {
    return c.json({ offers: [], currency: currencyFallback, sampledHotels: 0, retryable: false })
  }

  const occupancy: Record<string, unknown> = { adults: input.adults }
  if (input.children != null) occupancy.children = input.children
  if (input.childrenAges) occupancy.childrenAges = input.childrenAges
  const nights = input.nights ?? DEFAULT_NIGHTS

  // 3) Live packages/search per connection, batched by accommodationIds.
  const allOffers: Record<string, unknown>[] = []
  let sampledHotels = 0
  let retryable = false
  for (const [connectionId, accIds] of byConnection) {
    for (const batch of chunk(accIds, HOTELS_PER_CALL)) {
      sampledHotels += batch.length
      const body: Record<string, unknown> = {
        accommodationIds: batch,
        departureDateFrom: input.departureDateFrom,
        departureDateTo: input.departureDateTo,
        occupancy,
        nights,
        ...(input.boards ? { boards: input.boards } : {}),
        ...(input.minStars ? { minStars: input.minStars } : {}),
        ...(input.maxPriceMinor
          ? { maxPrice: { amountMinor: input.maxPriceMinor, currency: currencyFallback } }
          : {}),
        limit: input.limit ?? 200,
      }
      try {
        const res = await client.transport.request(
          `/connect/v1/connections/${connectionId}/packages/search`,
          { method: "POST", body, unwrapData: false },
        )
        allOffers.push(...readOffers(res))
      } catch (err) {
        const status = (err as { status?: number })?.status
        if (status == null || status >= 500) retryable = true
      }
    }
  }

  // 4) Cheapest offer per (hotel, departure date, departure airport) — keeping
  //    the origin lets the operator choose where they fly from. Enrich + list
  //    the available departure airports.
  const byKey = new Map<string, Record<string, unknown>>()
  const originCodes = new Set<string>()
  for (const offer of allOffers) {
    const id = offerProductId(offer)
    const date = offerCheckIn(offer)
    if (!id || !date) continue
    const origin = offerOrigin(offer) ?? ""
    if (origin) originCodes.add(origin)
    const key = `${id}__${date}__${origin}`
    const current = byKey.get(key)
    if (!current || offerTotalMinor(offer) < offerTotalMinor(current)) byKey.set(key, offer)
  }
  const chosen = [...byKey.values()]
    .sort((a, b) => offerTotalMinor(a) - offerTotalMinor(b))
    .slice(0, MAX_OFFERS)

  const indexFields = await options.fetchIndexFields(
    c,
    chosen.map(offerProductId).filter((x): x is string => Boolean(x)),
  )
  let currency = currencyFallback
  for (const offer of chosen) {
    const total = money((offer.pricing as { total?: unknown } | undefined)?.total)
    if (total) {
      currency = total.currency
      break
    }
  }
  const departureAirports = await options.resolveAirportLabels(c, [...originCodes])
  return c.json({
    offers: chosen.map((offer) =>
      mapSearchCard(offer, indexFields.get(offerProductId(offer) ?? "")),
    ),
    departureAirports,
    currency,
    sampledHotels,
    retryable,
  })
}

// ── Departure airports for a destination (drives the "Flying from" picker) ─
// A lightweight probe: which airports does this destination depart from? Run
// a small/short packages/search and collect the distinct flight origins so the
// operator can pick a departure airport BEFORE the full availability search.
async function handleDepartureAirports(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = airportsSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ departureAirports: [] }, 200)
  const input = parsed.data
  const client = options.resolveConnectClient(c)
  if (!client) return c.json({ departureAirports: [] }, 200)

  const hotelIds = await options.resolveDynamicHotelIds(c, input.destination, AIRPORT_PROBE_HOTELS)
  if (hotelIds.length === 0) return c.json({ departureAirports: [] }, 200)
  const db = c.get("db") as PostgresJsDatabase
  const entries = await db
    .select({
      entityId: catalogSourcedEntriesTable.entity_id,
      connectionId: catalogSourcedEntriesTable.source_connection_id,
      sourceRef: catalogSourcedEntriesTable.source_ref,
    })
    .from(catalogSourcedEntriesTable)
    .where(inArray(catalogSourcedEntriesTable.entity_id, hotelIds))
  const byConnection = new Map<string, string[]>()
  for (const entry of entries) {
    if (!entry.connectionId) continue
    const accId = (entry.sourceRef ?? entry.entityId).replace(/^[^:]+:/, "")
    const list = byConnection.get(entry.connectionId) ?? []
    list.push(accId)
    byConnection.set(entry.connectionId, list)
  }
  if (byConnection.size === 0) return c.json({ departureAirports: [] }, 200)

  const nights = input.nights ?? DEFAULT_NIGHTS
  const origins = new Set<string>()
  for (const [connectionId, accIds] of byConnection) {
    const body = {
      accommodationIds: accIds.slice(0, AIRPORT_PROBE_HOTELS),
      departureDateFrom: isoFromNow(10),
      departureDateTo: isoFromNow(120),
      occupancy: { adults: 2 },
      nights,
      limit: 100,
    }
    // TUI's offers API flaps (5xx); retry so the picker fills reliably.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await client.transport.request(
          `/connect/v1/connections/${connectionId}/packages/search`,
          { method: "POST", unwrapData: false, body },
        )
        for (const offer of readOffers(res)) {
          const origin = offerOrigin(offer)
          if (origin) origins.add(origin)
        }
        break
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500))
      }
    }
  }
  return c.json({ departureAirports: await options.resolveAirportLabels(c, [...origins]) })
}

// ── Cruise from-price (source) ──────────────────────────────────────────
// The cruise content route carries no price; the cruise-level "from" price
// lives on the Connect summary. Decode the catalog id → connection +
// externalId → getOnConnection → priceFromAmountMinor.
async function handleCruisePrice(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = cruisePriceSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ error: "invalid_request" }, 400)
  }
  const client = options.resolveConnectClient(c)
  const decoded = decodeCruiseCatalogId(parsed.data.cruiseId)
  if (!client || !decoded) {
    return c.json({ fromAmountMinor: null, currency: null }, 200)
  }
  try {
    const summary =
      asRecord(await client.cruises.getOnConnection(decoded.connectionId, decoded.externalId)) ?? {}
    return c.json({
      fromAmountMinor: asNum(summary.priceFromAmountMinor),
      currency: asStr(summary.priceFromCurrency),
    })
  } catch {
    return c.json({ fromAmountMinor: null, currency: null }, 200)
  }
}

// ── Per-cabin pricing for one sailing (source) ──────────────────────────
// Connect `listSailingPricing` returns a row per cabin × occupancy × fare ×
// currency; reduce to the cheapest *available* price per cabin in a single
// currency for the rate table on the cruise detail page.
async function handleCruiseSailingPricing(
  c: Context,
  options: CatalogOffersRouteModuleOptions,
): Promise<Response> {
  const parsed = cruiseSailingPricingSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ error: "invalid_request", cabins: [] }, 400)
  }
  const client = options.resolveConnectClient(c)
  const decoded = decodeCruiseCatalogId(parsed.data.cruiseId)
  if (!client || !decoded) {
    return c.json({ cabins: [], currency: null }, 200)
  }
  let rows: Record<string, unknown>[] = []
  try {
    const pricing = await client.cruises.listSailingPricing(
      decoded.connectionId,
      parsed.data.sailingRef,
    )
    rows = pricing.map((row) => asRecord(row) ?? {})
  } catch {
    return c.json({ cabins: [], currency: null, retryable: true }, 200)
  }
  // One currency (prefer USD), then cheapest available price per cabin.
  const currencies = rows.map((r) => asStr(asRecord(r.pricePerPerson)?.currency)).filter(Boolean)
  const currency = currencies.includes("USD") ? "USD" : (currencies[0] ?? null)
  const byCabin = new Map<string, { fromAmountMinor: number; available: boolean }>()
  for (const r of rows) {
    const pp = asRecord(r.pricePerPerson)
    if (asStr(pp?.currency) !== currency) continue
    const code = asStr(r.cabinCategoryId)
    const amount = asNum(pp?.amountMinor)
    if (!code || amount == null) continue
    const available = asStr(r.availability) !== "sold_out"
    const cur = byCabin.get(code)
    if (
      !cur ||
      (available && !cur.available) ||
      (available === cur.available && amount < cur.fromAmountMinor)
    ) {
      byCabin.set(code, { fromAmountMinor: amount, available })
    }
  }
  const cabins = [...byCabin.entries()]
    .map(([code, v]) => ({ code, fromAmountMinor: v.fromAmountMinor, available: v.available }))
    .sort((a, b) => a.fromAmountMinor - b.fromAmountMinor)
  return c.json({ cabins, currency })
}

// ─────────────────────────────────────────────────────────────────
// Pure mapping helpers
// ─────────────────────────────────────────────────────────────────

// Decode a `crus_sr_` catalog id back to its connection + provider externalId.
function decodeCruiseCatalogId(id: string): { connectionId: string; externalId: string } | null {
  if (!id.startsWith("crus_sr_")) return null
  try {
    const b64 = id.slice("crus_sr_".length).replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const obj = JSON.parse(atob(padded)) as { connectionId?: string; externalId?: string }
    return obj.connectionId && obj.externalId
      ? { connectionId: obj.connectionId, externalId: obj.externalId }
      : null
  } catch {
    return null
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function isoFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function offerCheckIn(offer: Record<string, unknown>): string | null {
  const checkIn = (offer.stay as { checkIn?: unknown } | undefined)?.checkIn
  return typeof checkIn === "string" ? checkIn.slice(0, 10) : null
}

function offerOrigin(offer: Record<string, unknown>): string | null {
  const flights = Array.isArray(offer.flights) ? (offer.flights as Record<string, unknown>[]) : []
  const origin = flights[0]?.origin
  return typeof origin === "string" ? origin : null
}

function offerProductId(offer: Record<string, unknown>): string | undefined {
  const ref = offer.productRef as { entityId?: unknown } | undefined
  return typeof ref?.entityId === "string" ? ref.entityId : undefined
}

function offerTotalMinor(offer: Record<string, unknown>): number {
  const total = (offer.pricing as { total?: { amountMinor?: unknown } } | undefined)?.total
  return typeof total?.amountMinor === "number" ? total.amountMinor : Number.POSITIVE_INFINITY
}

function mapSearchCard(offer: Record<string, unknown>, idx: CatalogOffersIndexFields | undefined) {
  const stay = (offer.stay ?? {}) as Record<string, unknown>
  const pricing = (offer.pricing ?? {}) as Record<string, unknown>
  const outbound = (
    Array.isArray(offer.flights) ? (offer.flights as Record<string, unknown>[]) : []
  )[0]
  return {
    productId: offerProductId(offer),
    name: idx?.name ?? offer.title ?? stay.name ?? null,
    image: idx?.thumbnailUrl ?? null,
    stars: idx?.stars ?? null,
    destination: idx?.destinations?.[0] ?? null,
    country: idx?.countryCodes?.[0] ?? null,
    board: stay.board ?? null,
    checkIn: stay.checkIn ?? null,
    checkOut: stay.checkOut ?? null,
    nights: stay.nights ?? null,
    departureAirport: (outbound?.origin as string | undefined) ?? null,
    arrivalAirport: (outbound?.destination as string | undefined) ?? null,
    carrier: (outbound?.carrier as string | undefined) ?? null,
    perPerson: money(pricing.perPerson),
    total: money(pricing.total),
  }
}

function readOffers(response: unknown): Record<string, unknown>[] {
  const root = (response ?? {}) as { offers?: unknown; data?: { offers?: unknown } }
  const offers = root.offers ?? root.data?.offers
  return Array.isArray(offers) ? (offers as Record<string, unknown>[]) : []
}

// Live dated package offers for one accommodation. Retries once on upstream 5xx
// (TUI staging flaps). Shared by package-offers + package-detail.
async function fetchLiveOffers(
  client: CatalogOffersConnectClient,
  connectionId: string,
  accommodationId: string,
  input: {
    departureDateFrom: string
    departureDateTo: string
    adults: number
    children?: number
    childrenAges?: number[]
    nights?: { min: number; max: number }
    boards?: string[]
    limit?: number
  },
): Promise<{ offers: Record<string, unknown>[]; retryable: boolean }> {
  const occupancy: Record<string, unknown> = { adults: input.adults }
  if (input.children != null) occupancy.children = input.children
  if (input.childrenAges) occupancy.childrenAges = input.childrenAges
  const body: Record<string, unknown> = {
    accommodationIds: [accommodationId],
    departureDateFrom: input.departureDateFrom,
    departureDateTo: input.departureDateTo,
    occupancy,
    // TUI's offers API rejects (400) a body without nights — always send it.
    nights: input.nights ?? DEFAULT_NIGHTS,
    ...(input.boards ? { boards: input.boards } : {}),
    ...(input.limit ? { limit: input.limit } : {}),
  }
  const path = `/connect/v1/connections/${connectionId}/packages/search`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.transport.request(path, { method: "POST", body })
      return { offers: readOffers(response), retryable: false }
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (attempt === 0 && (status == null || status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        continue
      }
      return { offers: [], retryable: true }
    }
  }
  return { offers: [], retryable: true }
}

// ── Accommodation detail mapping (Connect getOnConnection → render shape) ───
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}
function asStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
function asNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
function asLines(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : []
}

function mapAccommodationDetail(detail: Record<string, unknown>) {
  const content = asRecord(detail.content)
  const mediaRaw = Array.isArray(content?.media) ? content.media : []
  const media = mediaRaw
    .map((m) => {
      const r = asRecord(m)
      return {
        src: asStr(r?.src),
        rel: asStr(r?.rel),
        caption: asStr(r?.caption) ?? asStr(r?.title),
      }
    })
    .filter((m): m is { src: string; rel: string | null; caption: string | null } => Boolean(m.src))
  const sectionsRaw = Array.isArray(content?.sections) ? content.sections : []
  const sections = sectionsRaw
    .map((s) => {
      const r = asRecord(s)
      // `type` is the canonical role (HIGHLIGHT/ADDITIONAL_INFORMATION/…) so the
      // UI can fork rendering (e.g. lead with highlights) without supplier knowledge.
      return {
        title: asStr(r?.title),
        kind: asStr(r?.kind),
        type: asStr(r?.type),
        lines: asLines(r?.lines),
      }
    })
    .filter((s) => s.lines.length > 0)
  const featuresRaw = Array.isArray(content?.features) ? content.features : []
  const features = featuresRaw
    .map((f) => {
      const r = asRecord(f)
      return { code: asStr(r?.code), label: asStr(r?.shortDescription), type: asStr(r?.type) }
    })
    .filter((f) => f.label || f.code)
  const roomsRaw = Array.isArray(content?.rooms) ? content.rooms : []
  const rooms = roomsRaw.map((rm) => {
    const r = asRecord(rm)
    const firstMedia = asRecord((Array.isArray(r?.media) ? r.media : [])[0])
    return {
      // `code` is the join key to live offers' `roomTypeId` (same TUI room
      // codes), so the detail page can group offers under the right room.
      code: asStr(r?.code),
      name: asStr(r?.type) ?? asStr(r?.code),
      area: asNum(r?.area),
      maxGuests: asNum(r?.maxGuests),
      view: asStr(r?.view),
      specifications: asLines(r?.specifications),
      image: asStr(firstMedia?.src),
    }
  })
  const rev = asRecord(content?.reviews)
  const reviews = rev
    ? {
        source: asStr(rev.source),
        rating: asNum(rev.rating),
        reviewsCount: asNum(rev.reviewsCount),
        subratings: (Array.isArray(rev.subratings) ? rev.subratings : [])
          .map((s) => {
            const r = asRecord(s)
            return { name: asStr(r?.name), value: asNum(r?.value) }
          })
          .filter((s) => s.name && s.value != null),
      }
    : null
  return {
    name: asStr(detail.name),
    stars: asNum(detail.stars),
    city: asStr(detail.city),
    region: asStr(detail.region),
    countryCode: asStr(detail.countryCode),
    category: asStr(detail.category),
    media,
    sections,
    features,
    rooms,
    reviews,
  }
}

function mapOffer(offer: Record<string, unknown>) {
  const stay = (offer.stay ?? {}) as Record<string, unknown>
  const pricing = (offer.pricing ?? {}) as Record<string, unknown>
  const flights = Array.isArray(offer.flights) ? (offer.flights as Record<string, unknown>[]) : []
  const cancellation = (offer.cancellationPolicy ?? {}) as Record<string, unknown>
  return {
    id: offer.id,
    title: offer.title ?? stay.name ?? null,
    checkIn: stay.checkIn ?? null,
    checkOut: stay.checkOut ?? null,
    nights: stay.nights ?? null,
    board: stay.board ?? null,
    roomTypeId: stay.roomTypeId ?? null,
    ratePlanId: stay.ratePlanId ?? null,
    occupancy: stay.occupancy ?? null,
    perPerson: money(pricing.perPerson),
    total: money(pricing.total),
    flights: flights.map((flight) => ({
      origin: flight.origin ?? null,
      destination: flight.destination ?? null,
      departureAt: flight.departureAt ?? null,
      arrivalAt: flight.arrivalAt ?? null,
      carrier: flight.carrier ?? null,
      flightNumber: flight.flightNumber ?? null,
      flightType: flight.flightType ?? null,
    })),
    freeCancellationUntil: cancellation.freeCancellationUntil ?? null,
    expiresAt: offer.expiresAt ?? null,
  }
}

function money(value: unknown): { amountMinor: number; currency: string } | null {
  if (!value || typeof value !== "object") return null
  const m = value as { amountMinor?: unknown; currency?: unknown }
  if (typeof m.amountMinor !== "number" || typeof m.currency !== "string") return null
  return { amountMinor: m.amountMinor, currency: m.currency }
}
