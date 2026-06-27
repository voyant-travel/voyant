/**
 * Markets admin routes — markets, market locales, market currencies, FX rate
 * sets, exchange rates, market price catalogs, market product rules, and market
 * channel rules (CRUD + nested creates). Migrated to `@hono/zod-openapi` for the
 * OpenAPI admin backfill (voyant#2276 — step 3.5) via a NON-BREAKING dual-mount:
 * the same `OpenAPIHono` instance is exported as `marketsRoutes` and mounted by
 * the framework on BOTH the legacy `/v1/markets/*` surface (the commerce/
 * inventory dashboards still call those paths) AND the documented staff surface
 * at `/v1/admin/markets/*` (see `index.ts`). Request schemas reuse the exported
 * `validation.ts` insert/update/list-query schemas the handlers already parsed;
 * response row schemas live in `openapi-schemas.ts` (authored from the Drizzle
 * `$inferSelect` shapes; §17 timestamps/dates/numerics → strings). Business
 * logic and the wire envelopes (`{ data, total, limit, offset }` lists,
 * `{ data }` singles, `{ success: true }` deletes) are unchanged; handlers read
 * `c.req.valid(...)`.
 *
 * Each resource family is its own small `OpenAPIHono` sub-chain composed onto
 * the parent via `.route("/")` so the `.openapi()` operations propagate up while
 * keeping type-inference cost bounded (one flat chain has O(n²) inference cost).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  errorResponseSchema,
  exchangeRateSchema,
  fxRateSetSchema,
  idParamSchema,
  marketChannelRuleSchema,
  marketCurrencySchema,
  marketLocaleSchema,
  marketPriceCatalogSchema,
  marketProductRuleSchema,
  marketSchema,
  successResponseSchema,
} from "./openapi-schemas.js"
import { marketsService } from "./service.js"
import {
  exchangeRateListQuerySchema,
  fxRateSetListQuerySchema,
  insertExchangeRateSchema,
  insertFxRateSetSchema,
  insertMarketChannelRuleSchema,
  insertMarketCurrencySchema,
  insertMarketLocaleSchema,
  insertMarketPriceCatalogSchema,
  insertMarketProductRuleSchema,
  insertMarketSchema,
  marketChannelRuleListQuerySchema,
  marketCurrencyListQuerySchema,
  marketListQuerySchema,
  marketLocaleListQuerySchema,
  marketPriceCatalogListQuerySchema,
  marketProductRuleListQuerySchema,
  updateExchangeRateSchema,
  updateFxRateSetSchema,
  updateMarketChannelRuleSchema,
  updateMarketCurrencySchema,
  updateMarketLocaleSchema,
  updateMarketPriceCatalogSchema,
  updateMarketProductRuleSchema,
  updateMarketSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

// --- markets ----------------------------------------------------------------

const listMarketsRoute = createRoute({
  method: "get",
  path: "/markets",
  request: { query: marketListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of markets",
      ...jsonContent(listResponseSchema(marketSchema)),
    },
  },
})

const createMarketRoute = createRoute({
  method: "post",
  path: "/markets",
  request: requiredJsonBody(insertMarketSchema),
  responses: {
    201: { description: "The created market", ...jsonContent(z.object({ data: marketSchema })) },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getMarketRoute = createRoute({
  method: "get",
  path: "/markets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "A market by id", ...jsonContent(z.object({ data: marketSchema })) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateMarketRoute = createRoute({
  method: "patch",
  path: "/markets/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketSchema) },
  responses: {
    200: { description: "The updated market", ...jsonContent(z.object({ data: marketSchema })) },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteMarketRoute = createRoute({
  method: "delete",
  path: "/markets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const marketRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMarketsRoute, async (c) =>
    c.json(await marketsService.listMarkets(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createMarketRoute, async (c) => {
    const row = await marketsService.createMarket(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getMarketRoute, async (c) => {
    const row = await marketsService.getMarketById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(updateMarketRoute, async (c) => {
    const row = await marketsService.updateMarket(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(deleteMarketRoute, async (c) => {
    const row = await marketsService.deleteMarket(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market not found" }, 404)
  })

// --- market locales ---------------------------------------------------------

const listMarketLocalesRoute = createRoute({
  method: "get",
  path: "/market-locales",
  request: { query: marketLocaleListQuerySchema },
  responses: {
    200: {
      description: "Paginated market locales",
      ...jsonContent(listResponseSchema(marketLocaleSchema)),
    },
  },
})

const createMarketLocaleRoute = createRoute({
  method: "post",
  path: "/markets/{id}/locales",
  request: { params: idParamSchema, ...requiredJsonBody(insertMarketLocaleSchema) },
  responses: {
    201: {
      description: "The created market locale",
      ...jsonContent(z.object({ data: marketLocaleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateMarketLocaleRoute = createRoute({
  method: "patch",
  path: "/market-locales/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketLocaleSchema) },
  responses: {
    200: {
      description: "The updated market locale",
      ...jsonContent(z.object({ data: marketLocaleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market locale not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteMarketLocaleRoute = createRoute({
  method: "delete",
  path: "/market-locales/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market locale deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market locale not found", ...jsonContent(errorResponseSchema) },
  },
})

const localeRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMarketLocalesRoute, async (c) =>
    c.json(await marketsService.listMarketLocales(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createMarketLocaleRoute, async (c) => {
    const row = await marketsService.createMarketLocale(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(updateMarketLocaleRoute, async (c) => {
    const row = await marketsService.updateMarketLocale(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Market locale not found" }, 404)
  })
  .openapi(deleteMarketLocaleRoute, async (c) => {
    const row = await marketsService.deleteMarketLocale(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market locale not found" }, 404)
  })

// --- market currencies ------------------------------------------------------

const listMarketCurrenciesRoute = createRoute({
  method: "get",
  path: "/market-currencies",
  request: { query: marketCurrencyListQuerySchema },
  responses: {
    200: {
      description: "Paginated market currencies",
      ...jsonContent(listResponseSchema(marketCurrencySchema)),
    },
  },
})

const createMarketCurrencyRoute = createRoute({
  method: "post",
  path: "/markets/{id}/currencies",
  request: { params: idParamSchema, ...requiredJsonBody(insertMarketCurrencySchema) },
  responses: {
    201: {
      description: "The created market currency",
      ...jsonContent(z.object({ data: marketCurrencySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateMarketCurrencyRoute = createRoute({
  method: "patch",
  path: "/market-currencies/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketCurrencySchema) },
  responses: {
    200: {
      description: "The updated market currency",
      ...jsonContent(z.object({ data: marketCurrencySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market currency not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteMarketCurrencyRoute = createRoute({
  method: "delete",
  path: "/market-currencies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market currency deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market currency not found", ...jsonContent(errorResponseSchema) },
  },
})

const currencyRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMarketCurrenciesRoute, async (c) =>
    c.json(await marketsService.listMarketCurrencies(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createMarketCurrencyRoute, async (c) => {
    const row = await marketsService.createMarketCurrency(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(updateMarketCurrencyRoute, async (c) => {
    const row = await marketsService.updateMarketCurrency(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Market currency not found" }, 404)
  })
  .openapi(deleteMarketCurrencyRoute, async (c) => {
    const row = await marketsService.deleteMarketCurrency(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market currency not found" }, 404)
  })

// --- fx rate sets -----------------------------------------------------------

const listFxRateSetsRoute = createRoute({
  method: "get",
  path: "/fx-rate-sets",
  request: { query: fxRateSetListQuerySchema },
  responses: {
    200: {
      description: "Paginated FX rate sets",
      ...jsonContent(listResponseSchema(fxRateSetSchema)),
    },
  },
})

const createFxRateSetRoute = createRoute({
  method: "post",
  path: "/fx-rate-sets",
  request: requiredJsonBody(insertFxRateSetSchema),
  responses: {
    201: {
      description: "The created FX rate set",
      ...jsonContent(z.object({ data: fxRateSetSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getFxRateSetRoute = createRoute({
  method: "get",
  path: "/fx-rate-sets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An FX rate set by id",
      ...jsonContent(z.object({ data: fxRateSetSchema })),
    },
    404: { description: "FX rate set not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateFxRateSetRoute = createRoute({
  method: "patch",
  path: "/fx-rate-sets/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateFxRateSetSchema) },
  responses: {
    200: {
      description: "The updated FX rate set",
      ...jsonContent(z.object({ data: fxRateSetSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "FX rate set not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteFxRateSetRoute = createRoute({
  method: "delete",
  path: "/fx-rate-sets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "FX rate set deleted", ...jsonContent(successResponseSchema) },
    404: { description: "FX rate set not found", ...jsonContent(errorResponseSchema) },
  },
})

const fxRateSetRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFxRateSetsRoute, async (c) =>
    c.json(await marketsService.listFxRateSets(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createFxRateSetRoute, async (c) => {
    const row = await marketsService.createFxRateSet(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getFxRateSetRoute, async (c) => {
    const row = await marketsService.getFxRateSetById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "FX rate set not found" }, 404)
  })
  .openapi(updateFxRateSetRoute, async (c) => {
    const row = await marketsService.updateFxRateSet(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "FX rate set not found" }, 404)
  })
  .openapi(deleteFxRateSetRoute, async (c) => {
    const row = await marketsService.deleteFxRateSet(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "FX rate set not found" }, 404)
  })

// --- exchange rates ---------------------------------------------------------

const listExchangeRatesRoute = createRoute({
  method: "get",
  path: "/exchange-rates",
  request: { query: exchangeRateListQuerySchema },
  responses: {
    200: {
      description: "Paginated exchange rates",
      ...jsonContent(listResponseSchema(exchangeRateSchema)),
    },
  },
})

const createExchangeRateRoute = createRoute({
  method: "post",
  path: "/fx-rate-sets/{id}/exchange-rates",
  request: { params: idParamSchema, ...requiredJsonBody(insertExchangeRateSchema) },
  responses: {
    201: {
      description: "The created exchange rate",
      ...jsonContent(z.object({ data: exchangeRateSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "FX rate set not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateExchangeRateRoute = createRoute({
  method: "patch",
  path: "/exchange-rates/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateExchangeRateSchema) },
  responses: {
    200: {
      description: "The updated exchange rate",
      ...jsonContent(z.object({ data: exchangeRateSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Exchange rate not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteExchangeRateRoute = createRoute({
  method: "delete",
  path: "/exchange-rates/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Exchange rate deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Exchange rate not found", ...jsonContent(errorResponseSchema) },
  },
})

const exchangeRateRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listExchangeRatesRoute, async (c) =>
    c.json(await marketsService.listExchangeRates(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createExchangeRateRoute, async (c) => {
    const row = await marketsService.createExchangeRate(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "FX rate set not found" }, 404)
  })
  .openapi(updateExchangeRateRoute, async (c) => {
    const row = await marketsService.updateExchangeRate(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Exchange rate not found" }, 404)
  })
  .openapi(deleteExchangeRateRoute, async (c) => {
    const row = await marketsService.deleteExchangeRate(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Exchange rate not found" }, 404)
  })

// --- market price catalogs --------------------------------------------------

const listPriceCatalogsRoute = createRoute({
  method: "get",
  path: "/price-catalogs",
  request: { query: marketPriceCatalogListQuerySchema },
  responses: {
    200: {
      description: "Paginated market price catalogs",
      ...jsonContent(listResponseSchema(marketPriceCatalogSchema)),
    },
  },
})

const createPriceCatalogRoute = createRoute({
  method: "post",
  path: "/price-catalogs",
  request: requiredJsonBody(insertMarketPriceCatalogSchema),
  responses: {
    201: {
      description: "The created market price catalog",
      ...jsonContent(z.object({ data: marketPriceCatalogSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const getPriceCatalogRoute = createRoute({
  method: "get",
  path: "/price-catalogs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A market price catalog by id",
      ...jsonContent(z.object({ data: marketPriceCatalogSchema })),
    },
    404: { description: "Market price catalog not found", ...jsonContent(errorResponseSchema) },
  },
})

const updatePriceCatalogRoute = createRoute({
  method: "patch",
  path: "/price-catalogs/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketPriceCatalogSchema) },
  responses: {
    200: {
      description: "The updated market price catalog",
      ...jsonContent(z.object({ data: marketPriceCatalogSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market price catalog not found", ...jsonContent(errorResponseSchema) },
  },
})

const deletePriceCatalogRoute = createRoute({
  method: "delete",
  path: "/price-catalogs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market price catalog deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market price catalog not found", ...jsonContent(errorResponseSchema) },
  },
})

const priceCatalogRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPriceCatalogsRoute, async (c) =>
    c.json(await marketsService.listMarketPriceCatalogs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPriceCatalogRoute, async (c) => {
    const row = await marketsService.createMarketPriceCatalog(c.get("db"), c.req.valid("json"))
    return row ? c.json({ data: row }, 201) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(getPriceCatalogRoute, async (c) => {
    const row = await marketsService.getMarketPriceCatalogById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market price catalog not found" }, 404)
  })
  .openapi(updatePriceCatalogRoute, async (c) => {
    const row = await marketsService.updateMarketPriceCatalog(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market price catalog not found" }, 404)
  })
  .openapi(deletePriceCatalogRoute, async (c) => {
    const row = await marketsService.deleteMarketPriceCatalog(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market price catalog not found" }, 404)
  })

// --- market product rules ---------------------------------------------------

const listProductRulesRoute = createRoute({
  method: "get",
  path: "/product-rules",
  request: { query: marketProductRuleListQuerySchema },
  responses: {
    200: {
      description: "Paginated market product rules",
      ...jsonContent(listResponseSchema(marketProductRuleSchema)),
    },
  },
})

const createProductRuleRoute = createRoute({
  method: "post",
  path: "/product-rules",
  request: requiredJsonBody(insertMarketProductRuleSchema),
  responses: {
    201: {
      description: "The created market product rule",
      ...jsonContent(z.object({ data: marketProductRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const getProductRuleRoute = createRoute({
  method: "get",
  path: "/product-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A market product rule by id",
      ...jsonContent(z.object({ data: marketProductRuleSchema })),
    },
    404: { description: "Market product rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateProductRuleRoute = createRoute({
  method: "patch",
  path: "/product-rules/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketProductRuleSchema) },
  responses: {
    200: {
      description: "The updated market product rule",
      ...jsonContent(z.object({ data: marketProductRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market product rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteProductRuleRoute = createRoute({
  method: "delete",
  path: "/product-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market product rule deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market product rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const productRuleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductRulesRoute, async (c) =>
    c.json(await marketsService.listMarketProductRules(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createProductRuleRoute, async (c) => {
    const row = await marketsService.createMarketProductRule(c.get("db"), c.req.valid("json"))
    return row ? c.json({ data: row }, 201) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(getProductRuleRoute, async (c) => {
    const row = await marketsService.getMarketProductRuleById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market product rule not found" }, 404)
  })
  .openapi(updateProductRuleRoute, async (c) => {
    const row = await marketsService.updateMarketProductRule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market product rule not found" }, 404)
  })
  .openapi(deleteProductRuleRoute, async (c) => {
    const row = await marketsService.deleteMarketProductRule(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market product rule not found" }, 404)
  })

// --- market channel rules ---------------------------------------------------

const listChannelRulesRoute = createRoute({
  method: "get",
  path: "/channel-rules",
  request: { query: marketChannelRuleListQuerySchema },
  responses: {
    200: {
      description: "Paginated market channel rules",
      ...jsonContent(listResponseSchema(marketChannelRuleSchema)),
    },
  },
})

const createChannelRuleRoute = createRoute({
  method: "post",
  path: "/channel-rules",
  request: requiredJsonBody(insertMarketChannelRuleSchema),
  responses: {
    201: {
      description: "The created market channel rule",
      ...jsonContent(z.object({ data: marketChannelRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market not found", ...jsonContent(errorResponseSchema) },
  },
})

const getChannelRuleRoute = createRoute({
  method: "get",
  path: "/channel-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A market channel rule by id",
      ...jsonContent(z.object({ data: marketChannelRuleSchema })),
    },
    404: { description: "Market channel rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateChannelRuleRoute = createRoute({
  method: "patch",
  path: "/channel-rules/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateMarketChannelRuleSchema) },
  responses: {
    200: {
      description: "The updated market channel rule",
      ...jsonContent(z.object({ data: marketChannelRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Market channel rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteChannelRuleRoute = createRoute({
  method: "delete",
  path: "/channel-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Market channel rule deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Market channel rule not found", ...jsonContent(errorResponseSchema) },
  },
})

const channelRuleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listChannelRulesRoute, async (c) =>
    c.json(await marketsService.listMarketChannelRules(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createChannelRuleRoute, async (c) => {
    const row = await marketsService.createMarketChannelRule(c.get("db"), c.req.valid("json"))
    return row ? c.json({ data: row }, 201) : c.json({ error: "Market not found" }, 404)
  })
  .openapi(getChannelRuleRoute, async (c) => {
    const row = await marketsService.getMarketChannelRuleById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market channel rule not found" }, 404)
  })
  .openapi(updateChannelRuleRoute, async (c) => {
    const row = await marketsService.updateMarketChannelRule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Market channel rule not found" }, 404)
  })
  .openapi(deleteChannelRuleRoute, async (c) => {
    const row = await marketsService.deleteMarketChannelRule(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Market channel rule not found" }, 404)
  })

export const marketsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", marketRoutes)
  .route("/", localeRoutes)
  .route("/", currencyRoutes)
  .route("/", fxRateSetRoutes)
  .route("/", exchangeRateRoutes)
  .route("/", priceCatalogRoutes)
  .route("/", productRuleRoutes)
  .route("/", channelRuleRoutes)

export type MarketsRoutes = typeof marketsRoutes
