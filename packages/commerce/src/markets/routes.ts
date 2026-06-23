import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook, parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

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
  marketSchema,
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

/**
 * Tracer route for the OpenAPI adoption (voyant#2114): the contract is declared
 * once via `createRoute` — query validated against `marketListQuerySchema`, the
 * response typed as the canonical `listResponseSchema(marketSchema)` envelope —
 * and the generated doc is derived from these schemas, so it cannot drift from
 * the handler.
 */
const listMarketsRoute = createRoute({
  method: "get",
  path: "/markets",
  request: { query: marketListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of markets",
      content: {
        "application/json": { schema: listResponseSchema(marketSchema) },
      },
    },
  },
})

export const marketsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listMarketsRoute, async (c) => {
    const query = c.req.valid("query")
    return c.json(await marketsService.listMarkets(c.get("db"), query))
  })
  .post("/markets", async (c) => {
    return c.json(
      {
        data: await marketsService.createMarket(
          c.get("db"),
          await parseJsonBody(c, insertMarketSchema),
        ),
      },
      201,
    )
  })
  .get("/markets/:id", async (c) => {
    const row = await marketsService.getMarketById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/markets/:id", async (c) => {
    const row = await marketsService.updateMarket(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketSchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/markets/:id", async (c) => {
    const row = await marketsService.deleteMarket(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ success: true })
  })
  .get("/market-locales", async (c) => {
    const query = await parseQuery(c, marketLocaleListQuerySchema)
    return c.json(await marketsService.listMarketLocales(c.get("db"), query))
  })
  .post("/markets/:id/locales", async (c) => {
    const row = await marketsService.createMarketLocale(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertMarketLocaleSchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/market-locales/:id", async (c) => {
    const row = await marketsService.updateMarketLocale(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketLocaleSchema),
    )
    if (!row) return c.json({ error: "Market locale not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/market-locales/:id", async (c) => {
    const row = await marketsService.deleteMarketLocale(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market locale not found" }, 404)
    return c.json({ success: true })
  })
  .get("/market-currencies", async (c) => {
    const query = await parseQuery(c, marketCurrencyListQuerySchema)
    return c.json(await marketsService.listMarketCurrencies(c.get("db"), query))
  })
  .post("/markets/:id/currencies", async (c) => {
    const row = await marketsService.createMarketCurrency(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertMarketCurrencySchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/market-currencies/:id", async (c) => {
    const row = await marketsService.updateMarketCurrency(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketCurrencySchema),
    )
    if (!row) return c.json({ error: "Market currency not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/market-currencies/:id", async (c) => {
    const row = await marketsService.deleteMarketCurrency(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market currency not found" }, 404)
    return c.json({ success: true })
  })
  .get("/fx-rate-sets", async (c) => {
    const query = await parseQuery(c, fxRateSetListQuerySchema)
    return c.json(await marketsService.listFxRateSets(c.get("db"), query))
  })
  .post("/fx-rate-sets", async (c) => {
    return c.json(
      {
        data: await marketsService.createFxRateSet(
          c.get("db"),
          await parseJsonBody(c, insertFxRateSetSchema),
        ),
      },
      201,
    )
  })
  .get("/fx-rate-sets/:id", async (c) => {
    const row = await marketsService.getFxRateSetById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "FX rate set not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/fx-rate-sets/:id", async (c) => {
    const row = await marketsService.updateFxRateSet(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateFxRateSetSchema),
    )
    if (!row) return c.json({ error: "FX rate set not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/fx-rate-sets/:id", async (c) => {
    const row = await marketsService.deleteFxRateSet(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "FX rate set not found" }, 404)
    return c.json({ success: true })
  })
  .get("/exchange-rates", async (c) => {
    const query = await parseQuery(c, exchangeRateListQuerySchema)
    return c.json(await marketsService.listExchangeRates(c.get("db"), query))
  })
  .post("/fx-rate-sets/:id/exchange-rates", async (c) => {
    const row = await marketsService.createExchangeRate(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertExchangeRateSchema),
    )
    if (!row) return c.json({ error: "FX rate set not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/exchange-rates/:id", async (c) => {
    const row = await marketsService.updateExchangeRate(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateExchangeRateSchema),
    )
    if (!row) return c.json({ error: "Exchange rate not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/exchange-rates/:id", async (c) => {
    const row = await marketsService.deleteExchangeRate(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Exchange rate not found" }, 404)
    return c.json({ success: true })
  })
  .get("/price-catalogs", async (c) => {
    const query = await parseQuery(c, marketPriceCatalogListQuerySchema)
    return c.json(await marketsService.listMarketPriceCatalogs(c.get("db"), query))
  })
  .post("/price-catalogs", async (c) => {
    const row = await marketsService.createMarketPriceCatalog(
      c.get("db"),
      await parseJsonBody(c, insertMarketPriceCatalogSchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/price-catalogs/:id", async (c) => {
    const row = await marketsService.getMarketPriceCatalogById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market price catalog not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/price-catalogs/:id", async (c) => {
    const row = await marketsService.updateMarketPriceCatalog(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketPriceCatalogSchema),
    )
    if (!row) return c.json({ error: "Market price catalog not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/price-catalogs/:id", async (c) => {
    const row = await marketsService.deleteMarketPriceCatalog(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market price catalog not found" }, 404)
    return c.json({ success: true })
  })
  .get("/product-rules", async (c) => {
    const query = await parseQuery(c, marketProductRuleListQuerySchema)
    return c.json(await marketsService.listMarketProductRules(c.get("db"), query))
  })
  .post("/product-rules", async (c) => {
    const row = await marketsService.createMarketProductRule(
      c.get("db"),
      await parseJsonBody(c, insertMarketProductRuleSchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/product-rules/:id", async (c) => {
    const row = await marketsService.getMarketProductRuleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market product rule not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/product-rules/:id", async (c) => {
    const row = await marketsService.updateMarketProductRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketProductRuleSchema),
    )
    if (!row) return c.json({ error: "Market product rule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/product-rules/:id", async (c) => {
    const row = await marketsService.deleteMarketProductRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market product rule not found" }, 404)
    return c.json({ success: true })
  })
  .get("/channel-rules", async (c) => {
    const query = await parseQuery(c, marketChannelRuleListQuerySchema)
    return c.json(await marketsService.listMarketChannelRules(c.get("db"), query))
  })
  .post("/channel-rules", async (c) => {
    const row = await marketsService.createMarketChannelRule(
      c.get("db"),
      await parseJsonBody(c, insertMarketChannelRuleSchema),
    )
    if (!row) return c.json({ error: "Market not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .get("/channel-rules/:id", async (c) => {
    const row = await marketsService.getMarketChannelRuleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market channel rule not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/channel-rules/:id", async (c) => {
    const row = await marketsService.updateMarketChannelRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateMarketChannelRuleSchema),
    )
    if (!row) return c.json({ error: "Market channel rule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/channel-rules/:id", async (c) => {
    const row = await marketsService.deleteMarketChannelRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Market channel rule not found" }, 404)
    return c.json({ success: true })
  })

export type MarketsRoutes = typeof marketsRoutes
