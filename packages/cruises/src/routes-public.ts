import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseJsonBody } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import type { ExternalPassengerComposition, SourceRef } from "./adapters/index.js"
import { resolveCruiseAdapter } from "./adapters/registry.js"
import { encodeSourceRef, parseUnifiedKey, sourceRefFromExternalKeyRef } from "./lib/key.js"
import { createCruisesPublicRoute as createRoute } from "./routes-openapi.js"
import { cruisesService } from "./service.js"
import { composeQuote, pricingService } from "./service-pricing.js"
import { cruisesSearchService } from "./service-search.js"
import { searchIndexQuerySchema } from "./validation-search.js"
import { cruiseSourceSchema, cruiseTypeSchema } from "./validation-shared.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function cachePublicRead(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

const TYPEID_RE = /^[a-z]+_[0-9a-zA-Z]+$/

function isTypeId(s: string): boolean {
  return TYPEID_RE.test(s)
}

// ---------- request schemas ----------

const passengerCompositionSchema = z
  .object({
    adults: z.number().int().min(0),
    children: z.number().int().min(0).optional(),
    childAges: z.array(z.number().int().min(0).max(17)).optional(),
    infants: z.number().int().min(0).optional(),
    seniors: z.number().int().min(0).optional(),
  })
  .catchall(z.unknown())
  .refine(
    (value) =>
      value.adults + (value.children ?? 0) + (value.infants ?? 0) + (value.seniors ?? 0) > 0,
    "passengerComposition must include at least one passenger",
  )

const quotePayloadSchema = z.object({
  cabinCategoryId: z.string(),
  cabinCategoryRef: z.record(z.string(), z.unknown()).optional().nullable(),
  occupancy: z.number().int().min(1).max(8),
  guestCount: z.number().int().min(1).max(8).optional(),
  passengerComposition: passengerCompositionSchema.optional().nullable(),
  fareCode: z.string().optional().nullable(),
  fareVariant: z.enum(["cruise_only", "air_inclusive"]).optional().nullable(),
  bookingTerms: z.record(z.string(), z.unknown()).optional().nullable(),
})

// ---------- response schemas ----------

const errorResponseSchema = z.object({ error: z.string() }).catchall(z.unknown())

/**
 * Wire shape of a `cruise_search_index` row (voyant#2114). The list/slug
 * lookups serialize raw rows: jsonb `SourceRef` is provider-defined (opaque
 * pass-through), jsonb `string[]` arrays default to `[]`, and the date/timestamp
 * columns serialize to strings over the wire (§17) — Drizzle returns `date`
 * columns as strings already and `timestamp` columns as `Date`s that JSON-encode
 * to ISO strings, so the wire type is always a string.
 */
export const cruiseSearchIndexRowSchema = z.object({
  id: z.string(),
  source: cruiseSourceSchema,
  sourceProvider: z.string().nullable(),
  sourceRef: z.unknown().nullable(),
  localCruiseId: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  cruiseType: cruiseTypeSchema,
  lineName: z.string(),
  shipName: z.string(),
  nights: z.number().int(),
  embarkPortName: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortName: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  regionIds: z.array(z.string()).nullable(),
  waterwayIds: z.array(z.string()).nullable(),
  portIds: z.array(z.string()).nullable(),
  countryIso: z.array(z.string()).nullable(),
  regions: z.array(z.string()).nullable(),
  waterways: z.array(z.string()).nullable(),
  ports: z.array(z.string()).nullable(),
  countries: z.array(z.string()).nullable(),
  themes: z.array(z.string()).nullable(),
  earliestDeparture: z.string().nullable(),
  latestDeparture: z.string().nullable(),
  departureCount: z.number().int().nullable(),
  lowestPriceCents: z.number().int().nullable(),
  lowestPriceCurrency: z.string().nullable(),
  salesStatus: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  refreshedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * The cruise-detail (slug) response. `source` discriminates local vs external;
 * the `cruise`/`sailings` payloads are large aggregates (local DB row tree or a
 * provider-defined adapter shape), so they're documented as opaque
 * pass-throughs (`z.unknown()`) rather than fully modeled — bounded effort per
 * voyant#2190.
 */
const cruiseDetailResponseSchema = z.object({
  data: z.object({
    source: cruiseSourceSchema,
    sourceProvider: z.string().nullable(),
    sourceRef: z.unknown().nullable(),
    summary: cruiseSearchIndexRowSchema,
    cruise: z.unknown(),
    sailings: z.unknown().optional(),
  }),
})

/**
 * The sailing-detail response. `source` discriminates local vs external; the
 * `sailing` aggregate (plus optional adapter `pricing`/`itinerary`) is
 * provider-shaped, so documented as an opaque pass-through (bounded effort).
 */
const sailingDetailResponseSchema = z
  .object({
    data: z
      .object({
        source: cruiseSourceSchema,
        sourceProvider: z.string().optional(),
        sailing: z.unknown(),
        pricing: z.unknown().optional(),
        itinerary: z.unknown().optional(),
      })
      .catchall(z.unknown()),
  })
  .catchall(z.unknown())

/** A single line item of a composed cruise quote. */
const quoteComponentSchema = z.object({
  kind: z.string(),
  label: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  direction: z.enum(["addition", "inclusion", "credit"]),
  perPerson: z.boolean(),
})

/** The composed-quote response — identical shape for local and adapter paths. */
const quoteResponseSchema = z.object({
  data: z.object({
    fareCode: z.string().nullable(),
    fareCodeName: z.string().nullable(),
    fareVariant: z.enum(["cruise_only", "air_inclusive"]),
    currency: z.string(),
    occupancy: z.number().int(),
    guestCount: z.number().int(),
    basePerPerson: z.string(),
    originalPricePerPerson: z.string().nullable(),
    singlePricePerPerson: z.string().nullable(),
    earlyBookingDeadline: z.string().nullable(),
    earlyBookingBonusDescription: z.string().nullable(),
    components: z.array(quoteComponentSchema),
    totalPerPerson: z.string(),
    totalForCabin: z.string(),
    bookingTerms: z.unknown().nullable().optional(),
  }),
})

/**
 * The ship-detail response. Local ships return the ship row spread with
 * `decks`/`categories`; external ships return a provider-defined shape. Both are
 * documented as an opaque pass-through (bounded effort per voyant#2190).
 */
const shipDetailResponseSchema = z.object({
  data: z.unknown(),
})

// ---------- helpers ----------

function passengerCountFromComposition(
  composition: ExternalPassengerComposition | null | undefined,
): number | null {
  if (!composition) return null
  return (
    composition.adults +
    (composition.children ?? 0) +
    (composition.infants ?? 0) +
    (composition.seniors ?? 0)
  )
}

function resolveExternalKey(key: string): { provider: string; sourceRef: SourceRef } | null {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind !== "external") return null
  return { provider: parsed.provider, sourceRef: sourceRefFromExternalKeyRef(parsed.ref) }
}

function sourceRefFromPayload(
  maybeRef: Record<string, unknown> | null | undefined,
  externalId: string,
): SourceRef {
  if (maybeRef && typeof maybeRef.externalId === "string") return maybeRef as SourceRef
  return { externalId }
}

function sourceRefMatches(candidate: SourceRef, requested: SourceRef): boolean {
  if (encodeSourceRef(candidate) === encodeSourceRef(requested)) return true
  const candidateIsLegacy = Object.keys(candidate).length === 1
  const requestedIsLegacy = Object.keys(requested).length === 1
  return (candidateIsLegacy || requestedIsLegacy) && candidate.externalId === requested.externalId
}

function passengerCompositionMatches(
  candidate: ExternalPassengerComposition | null | undefined,
  requested: ExternalPassengerComposition | null | undefined,
): boolean {
  if (!requested || !candidate) return true
  return (
    encodeSourceRef({
      externalId: "composition",
      ...candidate,
    }) === encodeSourceRef({ externalId: "composition", ...requested })
  )
}

// ---------- route definitions ----------

const listCruisesRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: searchIndexQuerySchema },
  responses: {
    200: {
      description: "Paginated list of public cruise search-index rows",
      content: {
        "application/json": { schema: listResponseSchema(cruiseSearchIndexRowSchema) },
      },
    },
  },
})

const cruiseBySlugRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: "A public cruise by slug (local aggregate or external adapter shape)",
      content: { "application/json": { schema: cruiseDetailResponseSchema } },
    },
    404: {
      description: "Cruise not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: {
      description: "Search-index entry is malformed",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const sailingByKeyRoute = createRoute({
  method: "get",
  path: "/sailings/{key}",
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: {
      description: "A sailing by unified key (local id or external key)",
      content: { "application/json": { schema: sailingDetailResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Sailing not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const quoteSailingRoute = createRoute({
  method: "post",
  path: "/sailings/{key}/quote",
  request: {
    params: z.object({ key: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: quotePayloadSchema } },
    },
  },
  responses: {
    200: {
      description: "A composed quote for the requested cabin/occupancy",
      content: { "application/json": { schema: quoteResponseSchema } },
    },
    400: {
      description: "Missing guest count, invalid key, or invalid payload",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "No matching price for the requested cabin/occupancy",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const shipByKeyRoute = createRoute({
  method: "get",
  path: "/ships/{key}",
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: {
      description: "A ship by unified key (local aggregate or external adapter shape)",
      content: { "application/json": { schema: shipDetailResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Ship not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

/**
 * Public/storefront routes. Reads exclusively from `cruise_search_index` for
 * list and slug lookups; detail endpoints (sailing, ship, quote) resolve
 * through the appropriate source — local DB for source='local' rows, the
 * registered adapter for source='external'.
 *
 * Operators that don't run a Voyant-powered storefront leave the search index
 * empty; the list endpoint returns no rows but detail endpoints still work
 * for direct sailing/ship key lookups.
 *
 * `.openapi()` definitions are declared before any imperative routing
 * (honojs/middleware#637) and ordered static-before-param (`/sailings/*`,
 * `/ships/*` before `/{slug}`) so the registry's path-merge matches runtime.
 */
export const cruisePublicRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listCruisesRoute, async (c) => {
    const result = await cruisesSearchService.query(c.get("db"), c.req.valid("query"))
    cachePublicRead(c)
    return c.json(result, 200)
  })
  .openapi(sailingByKeyRoute, async (c) => {
    const key = c.req.valid("param").key
    if (isTypeId(key)) {
      const sailing = await cruisesService.getSailingById(c.get("db"), key, {
        withPricing: true,
        withItinerary: true,
      })
      if (!sailing) return c.json({ error: "not_found" }, 404)
      cachePublicRead(c)
      return c.json({ data: { source: "local", sailing } }, 200)
    }
    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const sailing = await adapter.fetchSailing(parsed.sourceRef)
    if (!sailing) return c.json({ error: "not_found" }, 404)
    const [pricing, itinerary] = await Promise.all([
      adapter.fetchSailingPricing(parsed.sourceRef),
      adapter.fetchSailingItinerary(parsed.sourceRef),
    ])
    cachePublicRead(c)
    return c.json(
      {
        data: { source: "external", sourceProvider: adapter.name, sailing, pricing, itinerary },
      },
      200,
    )
  })
  .openapi(quoteSailingRoute, async (c) => {
    const key = c.req.valid("param").key
    const payload = await parseJsonBody(c, quotePayloadSchema)
    const guestCount =
      payload.guestCount ?? passengerCountFromComposition(payload.passengerComposition)
    if (!guestCount) {
      return c.json(
        {
          error: "guest_count_required",
          detail: "Provide guestCount or passengerComposition for cruise quote requests.",
        },
        400,
      )
    }

    if (isTypeId(key)) {
      const quote = await pricingService.assembleQuote(c.get("db"), {
        sailingId: key,
        cabinCategoryId: payload.cabinCategoryId,
        occupancy: payload.occupancy,
        guestCount,
        fareCode: payload.fareCode ?? null,
        fareVariant: payload.fareVariant ?? null,
      })
      return c.json({ data: quote }, 200)
    }

    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const prices = await adapter.fetchSailingPricing(parsed.sourceRef)
    const cabinCategoryRef = sourceRefFromPayload(payload.cabinCategoryRef, payload.cabinCategoryId)
    const matching = prices.find(
      (p) =>
        sourceRefMatches(p.cabinCategoryRef, cabinCategoryRef) &&
        p.occupancy === payload.occupancy &&
        passengerCompositionMatches(p.passengerComposition, payload.passengerComposition) &&
        (!payload.fareCode || p.fareCode === payload.fareCode) &&
        (!payload.fareVariant || p.fareVariant === payload.fareVariant),
    )
    if (!matching) return c.json({ error: "no_matching_price" }, 404)
    const quote = composeQuote({
      price: {
        pricePerPerson: matching.pricePerPerson,
        originalPricePerPerson: matching.originalPricePerPerson ?? null,
        secondGuestPricePerPerson: matching.secondGuestPricePerPerson ?? null,
        singlePricePerPerson: matching.singlePricePerPerson ?? null,
        singleSupplementPercent: matching.singleSupplementPercent ?? null,
        currency: matching.currency,
        fareCode: matching.fareCode ?? null,
        fareCodeName: matching.fareCodeName ?? null,
        fareVariant: matching.fareVariant ?? "cruise_only",
        earlyBookingDeadline: matching.earlyBookingDeadline ?? null,
        earlyBookingBonusDescription: matching.earlyBookingBonusDescription ?? null,
      },
      components: (matching.components ?? []).map((comp) => ({
        kind: comp.kind,
        label: comp.label ?? null,
        amount: comp.amount,
        currency: comp.currency,
        direction: comp.direction,
        perPerson: comp.perPerson,
      })),
      occupancy: payload.occupancy,
      guestCount,
      bookingTerms: payload.bookingTerms ?? matching.bookingTerms ?? null,
    })
    return c.json({ data: quote }, 200)
  })
  .openapi(shipByKeyRoute, async (c) => {
    const key = c.req.valid("param").key
    if (isTypeId(key)) {
      const ship = await cruisesService.getShipById(c.get("db"), key)
      if (!ship) return c.json({ error: "not_found" }, 404)
      const [decks, categories] = await Promise.all([
        cruisesService.listShipDecks(c.get("db"), key),
        cruisesService.listShipCabinCategories(c.get("db"), key),
      ])
      cachePublicRead(c)
      return c.json({ data: { ...ship, decks, categories } }, 200)
    }
    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const ship = await adapter.fetchShip(parsed.sourceRef)
    if (!ship) return c.json({ error: "not_found" }, 404)
    cachePublicRead(c)
    return c.json({ data: ship }, 200)
  })
  .openapi(cruiseBySlugRoute, async (c) => {
    const slug = c.req.valid("param").slug
    const indexEntry = await cruisesSearchService.getBySlug(c.get("db"), slug)
    if (!indexEntry) return c.json({ error: "not_found" }, 404)

    if (indexEntry.source === "local" && indexEntry.localCruiseId) {
      const detail = await cruisesService.getCruiseById(c.get("db"), indexEntry.localCruiseId, {
        withSailings: true,
        withDays: true,
      })
      if (!detail) return c.json({ error: "not_found" }, 404)
      cachePublicRead(c)
      return c.json(
        {
          data: {
            source: "local" as const,
            sourceProvider: null,
            sourceRef: null,
            summary: indexEntry,
            cruise: detail,
          },
        },
        200,
      )
    }

    if (indexEntry.source === "external" && indexEntry.sourceProvider && indexEntry.sourceRef) {
      const externalId = indexEntry.sourceRef.externalId
      if (typeof externalId !== "string" || externalId.length === 0) {
        return c.json({ error: "invalid_index_entry", detail: "sourceRef.externalId missing" }, 500)
      }
      const adapter = resolveCruiseAdapter(indexEntry.sourceProvider)
      if (!adapter) {
        return c.json(
          {
            error: "adapter_not_registered",
            detail: `Search-index entry references provider '${indexEntry.sourceProvider}' but no adapter is registered.`,
          },
          501,
        )
      }
      const adapterRef = { ...indexEntry.sourceRef, externalId }
      const cruise = await adapter.fetchCruise(adapterRef)
      if (!cruise) return c.json({ error: "not_found" }, 404)
      const sailings = await adapter.listSailingsForCruise(adapterRef)
      cachePublicRead(c)
      return c.json(
        {
          data: {
            source: "external" as const,
            sourceProvider: adapter.name,
            sourceRef: adapterRef,
            summary: indexEntry,
            cruise,
            sailings,
          },
        },
        200,
      )
    }

    return c.json({ error: "invalid_index_entry" }, 500)
  })

export type CruisePublicRoutes = typeof cruisePublicRoutes
