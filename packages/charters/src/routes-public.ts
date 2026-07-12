import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseJsonBody } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { listCharterAdapters, resolveCharterAdapter } from "./adapters/registry.js"
import { parseUnifiedKey } from "./lib/key.js"
import { createChartersPublicRoute } from "./routes-openapi.js"
import { chartersService } from "./service.js"
import { composePerSuiteQuote, composeWholeYachtQuote, pricingService } from "./service-pricing.js"
import { productListQuerySchema, voyageListQuerySchema } from "./validation-core.js"
import {
  charterBookingModeSchema,
  charterSourceSchema,
  currencyCodeSchema,
  voyageSalesStatusSchema,
} from "./validation-shared.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function cachePublicRead(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

// ---------- request schemas ----------

const perSuiteQuotePayload = z.object({
  suiteId: z.string(),
  currency: currencyCodeSchema,
})
const wholeYachtQuotePayload = z.object({
  currency: currencyCodeSchema,
})

// ---------- response schemas ----------

const errorResponseSchema = z.object({ error: z.string() }).catchall(z.unknown())

/**
 * Wire shape of a `charter_voyages` row (voyant#2191). The voyages list and the
 * local voyage-detail path serialize raw rows: jsonb maps are provider-defined
 * data (`bookingModes` is a typed enum array, `wholeYachtPricesByCurrency` /
 * `externalRefs` are open string maps), and the `date`/`timestamp` columns
 * serialize to strings over the wire (§17) — Drizzle returns `date` columns as
 * strings already and `timestamp` columns as `Date`s that JSON-encode to ISO
 * strings, so the wire type is always a string.
 */
export const voyageItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  yachtId: z.string(),
  voyageCode: z.string(),
  name: z.string().nullable(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortName: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortName: z.string().nullable(),
  departureDate: z.string(),
  returnDate: z.string(),
  nights: z.number().int(),
  bookingModes: z.array(charterBookingModeSchema),
  appointmentOnly: z.boolean(),
  wholeYachtPricesByCurrency: z.record(z.string(), z.string()),
  apaPercentOverride: z.string().nullable(),
  mybaTemplateIdOverride: z.string().nullable(),
  charterAreaOverride: z.string().nullable(),
  salesStatus: voyageSalesStatusSchema,
  availabilityNote: z.string().nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * A single row of the unified charter-browse list. `source` discriminates a
 * local `live` product from an external adapter entry. The `product` payload is
 * a large aggregate (a local DB row tree or a provider-defined adapter shape),
 * so it's documented as an opaque pass-through (`z.unknown()`) rather than fully
 * modeled — bounded effort per voyant#2190/#2191. The discriminant + key fields
 * are modeled honestly so consumers can dispatch.
 */
const charterBrowseItemSchema = z.object({
  source: charterSourceSchema,
  sourceProvider: z.string().nullable(),
  sourceRef: z.unknown().nullable(),
  key: z.string(),
  product: z.unknown(),
})

/**
 * The unified charter-browse envelope. Hand-built (not `listResponse`) because
 * it fans local products in with every adapter's entries, so it carries the
 * standard `{ data, total, limit, offset }` shape inline.
 */
const charterBrowseResponseSchema = z.object({
  data: z.array(charterBrowseItemSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

/**
 * The product-detail response. Local lookups return `{ data: <aggregate> }`;
 * external lookups return `{ data: { source: "external", product, voyages,
 * yacht, … } }`. Both `data` payloads are large aggregates (local row tree or a
 * provider-defined adapter shape), documented as an opaque pass-through (bounded
 * effort).
 */
const charterProductDetailResponseSchema = z.object({
  data: z.unknown(),
})

/**
 * The voyage-detail response. The local branch returns the `charter_voyages`
 * row spread with optional `suites`/`schedule` arrays; the external branch
 * returns a provider-defined shape. Modeled as a union — the local branch is
 * typed via `voyageItemSchema`, external + nested aggregates are opaque
 * pass-throughs (bounded effort).
 */
export const voyageDetailResponseSchema = z.object({
  data: z.union([
    voyageItemSchema.extend({
      suites: z.array(z.unknown()).optional(),
      schedule: z.array(z.unknown()).optional(),
    }),
    z
      .object({
        source: z.literal("external"),
        sourceProvider: z.string(),
        sourceRef: z.unknown(),
        voyage: z.unknown(),
        suites: z.unknown(),
        schedule: z.unknown(),
      })
      .catchall(z.unknown()),
  ]),
})

/** A composed per-suite quote — identical shape for local and adapter paths. */
export const perSuiteQuoteResponseSchema = z.object({
  data: z.object({
    mode: z.literal("per_suite"),
    voyageId: z.string(),
    suiteId: z.string(),
    suiteName: z.string(),
    currency: z.string(),
    suitePrice: z.string(),
    portFee: z.string().nullable(),
    total: z.string(),
  }),
})

/** A composed whole-yacht quote — identical shape for local and adapter paths. */
export const wholeYachtQuoteResponseSchema = z.object({
  data: z.object({
    mode: z.literal("whole_yacht"),
    voyageId: z.string(),
    currency: z.string(),
    charterFee: z.string(),
    apaPercent: z.string(),
    apaAmount: z.string(),
    total: z.string(),
  }),
})

/**
 * The yacht-detail response. Local yachts return the yacht row (optionally with
 * decks/cabins); external yachts return a provider-defined shape. Both are
 * documented as an opaque pass-through (bounded effort).
 */
const yachtDetailResponseSchema = z.object({
  data: z.unknown(),
})

// ---------- route definitions ----------

const listChartersRoute = createChartersPublicRoute({
  method: "get",
  path: "/",
  request: { query: productListQuerySchema },
  responses: {
    200: {
      description:
        "Unified charter browse: local `live` products fanned in with every registered adapter's entries",
      content: { "application/json": { schema: charterBrowseResponseSchema } },
    },
  },
})

const listVoyagesRoute = createChartersPublicRoute({
  method: "get",
  path: "/voyages",
  request: { query: voyageListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of local charter voyages",
      content: { "application/json": { schema: listResponseSchema(voyageItemSchema) } },
    },
  },
})

const voyageByKeyRoute = createChartersPublicRoute({
  method: "get",
  path: "/voyages/{key}",
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: {
      description: "A voyage by unified key (local row or external adapter shape)",
      content: { "application/json": { schema: voyageDetailResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Voyage not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const quotePerSuiteRoute = createChartersPublicRoute({
  method: "post",
  path: "/voyages/{key}/quote/per-suite",
  request: {
    params: z.object({ key: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: perSuiteQuotePayload } },
    },
  },
  responses: {
    200: {
      description: "A composed per-suite quote for the requested suite/currency",
      content: { "application/json": { schema: perSuiteQuoteResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "No matching suite for the requested key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const quoteWholeYachtRoute = createChartersPublicRoute({
  method: "post",
  path: "/voyages/{key}/quote/whole-yacht",
  request: {
    params: z.object({ key: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: wholeYachtQuotePayload } },
    },
  },
  responses: {
    200: {
      description: "A composed whole-yacht quote for the requested currency",
      content: { "application/json": { schema: wholeYachtQuoteResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Voyage not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const yachtByKeyRoute = createChartersPublicRoute({
  method: "get",
  path: "/yachts/{key}",
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: {
      description: "A yacht by unified key (local aggregate or external adapter shape)",
      content: { "application/json": { schema: yachtDetailResponseSchema } },
    },
    400: {
      description: "Key is not a valid local id or external key",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Yacht not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productByKeyRoute = createChartersPublicRoute({
  method: "get",
  path: "/products/{key}",
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: {
      description: "A charter product by unified key (local aggregate or external adapter shape)",
      content: { "application/json": { schema: charterProductDetailResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    501: {
      description: "Referenced adapter is not registered",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

/**
 * Public-facing charter routes. Browsing fans out to local `live` products +
 * every registered adapter; detail routes accept either a TypeID slug or a
 * `<provider>:<ref>` external key resolved through the process-global charter
 * adapter registry.
 *
 * Charters has no dedicated search index — the operator universe is small
 * enough that direct `listEntries` fan-out is fine.
 *
 * `.openapi()` definitions are declared before any imperative routing
 * (honojs/middleware#637) and ordered static-before-param (`/voyages`,
 * `/voyages/{key}` quote posts, `/yachts/{key}` before the catch-all
 * `/products/{key}`) so the registry's path-merge matches runtime.
 */
export const chartersPublicRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listChartersRoute, async (c) => {
    const query = c.req.valid("query")
    const local = await chartersService.listProducts(c.get("db"), { ...query, status: "live" })
    const localItems = local.data.map((p) => ({
      source: "local" as const,
      sourceProvider: null,
      sourceRef: null,
      key: p.slug,
      product: p,
    }))
    const adapters = listCharterAdapters()
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter
          .listEntries({ limit: query.limit })
          .then((result) => ({ adapter, result }) as const),
      ),
    )
    const adapterItems: Array<{
      source: "external"
      sourceProvider: string
      sourceRef: unknown
      key: string
      product: unknown
    }> = []
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const adapter = adapters[i]
      if (!outcome || !adapter) continue
      if (outcome.status === "rejected") continue
      for (const entry of outcome.value.result.entries) {
        adapterItems.push({
          source: "external" as const,
          sourceProvider: adapter.name,
          sourceRef: entry.sourceRef,
          key: `${adapter.name}:${entry.sourceRef.externalId}`,
          product: entry,
        })
      }
    }
    cachePublicRead(c)
    return c.json(
      {
        data: [...localItems, ...adapterItems],
        total: local.total + adapterItems.length,
        limit: local.limit,
        offset: local.offset,
      },
      200,
    )
  })
  .openapi(listVoyagesRoute, async (c) => {
    const query = c.req.valid("query")
    const result = await chartersService.listVoyages(c.get("db"), query, { productStatus: "live" })
    cachePublicRead(c)
    return c.json(result, 200)
  })
  .openapi(voyageByKeyRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const ref = { externalId: parsed.ref }
      const voyage = await adapter.fetchVoyage(ref)
      if (!voyage) return c.json({ error: "not_found" }, 404)
      const [suites, schedule] = await Promise.all([
        adapter.fetchVoyageSuites(ref),
        adapter.fetchVoyageSchedule(ref),
      ])
      cachePublicRead(c)
      return c.json(
        {
          data: {
            source: "external" as const,
            sourceProvider: adapter.name,
            sourceRef: voyage.sourceRef,
            voyage,
            suites,
            schedule,
          },
        },
        200,
      )
    }
    const row = await chartersService.getVoyageById(c.get("db"), parsed.id, {
      withSuites: true,
      withSchedule: true,
      productStatus: "live",
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    cachePublicRead(c)
    return c.json({ data: row }, 200)
  })
  .openapi(quotePerSuiteRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    const payload = await parseJsonBody(c, perSuiteQuotePayload)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const suites = await adapter.fetchVoyageSuites({ externalId: parsed.ref })
      const matching = suites.find((s) => s.sourceRef.externalId === payload.suiteId)
      if (!matching) return c.json({ error: "no_matching_suite" }, 404)
      const quote = composePerSuiteQuote({
        voyageId: parsed.ref,
        suite: {
          id: matching.sourceRef.externalId,
          suiteName: matching.suiteName,
          pricesByCurrency: matching.pricesByCurrency ?? {},
          portFeesByCurrency: matching.portFeesByCurrency ?? {},
        },
        currency: payload.currency,
      })
      return c.json({ data: quote }, 200)
    }
    // Gate to a live voyage (P1) and verify the requested suite belongs to the
    // URL voyage (P2) — a suite from another voyage must not return a quote
    // under this URL. `payload.suiteId` is the suite's TypeID (`charter_suites.id`),
    // the same field `pricingService.quotePerSuite` looks up.
    const voyage = await chartersService.getVoyageById(c.get("db"), parsed.id, {
      withSuites: true,
      productStatus: "live",
    })
    if (!voyage) return c.json({ error: "not_found" }, 404)
    const matching = voyage.suites?.find((s) => s.id === payload.suiteId)
    if (!matching) return c.json({ error: "no_matching_suite" }, 404)
    const quote = await pricingService.quotePerSuite(c.get("db"), {
      suiteId: payload.suiteId,
      currency: payload.currency,
    })
    return c.json({ data: quote }, 200)
  })
  .openapi(quoteWholeYachtRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    const payload = await parseJsonBody(c, wholeYachtQuotePayload)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const ref = { externalId: parsed.ref }
      const voyage = await adapter.fetchVoyage(ref)
      if (!voyage) return c.json({ error: "not_found" }, 404)
      const product = await adapter.fetchProduct(voyage.productRef)
      const quote = composeWholeYachtQuote({
        voyage: {
          id: voyage.sourceRef.externalId,
          wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency ?? {},
          apaPercentOverride: voyage.apaPercentOverride ?? null,
        },
        productDefaultApaPercent: product?.defaultApaPercent ?? null,
        currency: payload.currency,
      })
      return c.json({ data: quote }, 200)
    }
    // Gate to a live voyage (P1) before quoting — draft/archived products'
    // voyages must not be quotable on the anonymous surface.
    const voyage = await chartersService.getVoyageById(c.get("db"), parsed.id, {
      productStatus: "live",
    })
    if (!voyage) return c.json({ error: "not_found" }, 404)
    const quote = await pricingService.quoteWholeYacht(c.get("db"), {
      voyageId: parsed.id,
      currency: payload.currency,
    })
    return c.json({ data: quote }, 200)
  })
  .openapi(yachtByKeyRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const yacht = await adapter.fetchYacht({ externalId: parsed.ref })
      if (!yacht) return c.json({ error: "not_found" }, 404)
      cachePublicRead(c)
      return c.json({ data: yacht }, 200)
    }
    const row = await chartersService.getYachtById(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    cachePublicRead(c)
    return c.json({ data: row }, 200)
  })
  .openapi(productByKeyRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const product = await adapter.fetchProduct({ externalId: parsed.ref })
      if (!product) return c.json({ error: "not_found" }, 404)
      const voyages = await adapter.listVoyagesForProduct({ externalId: parsed.ref })
      const yacht = product.defaultYachtRef
        ? await adapter.fetchYacht(product.defaultYachtRef)
        : null
      cachePublicRead(c)
      return c.json(
        {
          data: {
            source: "external" as const,
            sourceProvider: adapter.name,
            sourceRef: product.sourceRef,
            product,
            voyages,
            yacht,
          },
        },
        200,
      )
    }
    if (parsed.kind === "local") {
      const detail = await chartersService.getProductById(c.get("db"), parsed.id, {
        withVoyages: true,
        withYacht: true,
      })
      if (!detail || detail.status !== "live") return c.json({ error: "not_found" }, 404)
      cachePublicRead(c)
      return c.json({ data: detail }, 200)
    }
    // parsed.kind === "invalid": treat the raw param as a slug lookup
    const result = await chartersService.listProducts(c.get("db"), {
      status: "live",
      limit: 1,
      offset: 0,
    })
    const match = result.data.find((p) => p.slug === parsed.raw)
    if (!match) return c.json({ error: "not_found" }, 404)
    const detail = await chartersService.getProductById(c.get("db"), match.id, {
      withVoyages: true,
      withYacht: true,
    })
    if (!detail || detail.status !== "live") return c.json({ error: "not_found" }, 404)
    cachePublicRead(c)
    return c.json({ data: detail }, 200)
  })

export type ChartersPublicRoutes = typeof chartersPublicRoutes
