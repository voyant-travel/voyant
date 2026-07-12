/**
 * Public market discovery route (voyant#2643). Mounted by the framework at
 * `/v1/public/markets` and declared `anonymous` (see `index.ts`), so anonymous
 * storefront clients can resolve the supported markets/locales/currencies WITHOUT
 * admin auth. Read-only; returns only the narrow public projection built by
 * `listPublicMarkets` — no admin/tenant-internal fields (see `service-public.ts`).
 *
 * The admin market CRUD surface stays in `routes.ts` under `/v1/admin/markets/*`
 * (and the legacy `/v1/markets/*`); this file adds ONLY the customer read path.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { createMarketsPublicRoute } from "./routes-openapi.js"
import { listPublicMarkets } from "./service-public.js"

type Env = { Variables: { db: PostgresJsDatabase } }

const PUBLIC_MARKETS_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

const publicMarketLocaleSchema = z.object({
  languageTag: z.string(),
  isDefault: z.boolean(),
})

const publicMarketCurrencySchema = z.object({
  currencyCode: z.string(),
  isDefault: z.boolean(),
})

/** Customer-facing market discovery row — mirrors `PublicMarket`. */
export const publicMarketSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  regionCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  defaultLocale: z.string(),
  defaultCurrency: z.string(),
  locales: z.array(publicMarketLocaleSchema),
  currencies: z.array(publicMarketCurrencySchema),
})

const listPublicMarketsRoute = createMarketsPublicRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "The supported markets, locales, and currencies for anonymous discovery",
      content: { "application/json": { schema: z.object({ data: z.array(publicMarketSchema) }) } },
    },
  },
})

function cachePublicMarkets(c: Context): void {
  c.header("Cache-Control", PUBLIC_MARKETS_CACHE_CONTROL)
}

export const publicMarketsRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
}).openapi(listPublicMarketsRoute, async (c) => {
  const data = await listPublicMarkets(c.get("db"))
  cachePublicMarkets(c)
  return c.json({ data }, 200)
})

export type PublicMarketsRoutes = typeof publicMarketsRoutes
