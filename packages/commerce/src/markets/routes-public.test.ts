import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { publicMarketsRoutes } from "./routes-public.js"
import { marketCurrencies, marketLocales, markets } from "./schema.js"
import { listPublicMarkets } from "./service-public.js"

/**
 * Public market discovery (voyant#2643). Anonymous storefront clients must be
 * able to resolve the supported markets/locales/currencies WITHOUT admin auth,
 * and the response must NOT leak any admin/tenant-internal market fields.
 *
 * The fake db mirrors the drizzle select→from→where→orderBy chain the service
 * uses, resolving each terminal `orderBy()` to the canned rows for the table
 * captured at `.from(...)`. Rows are already in the SELECTed projection shape.
 */

interface FakeDbData {
  markets: Array<{
    id: string
    code: string
    name: string
    regionCode: string | null
    countryCode: string | null
    defaultLanguageTag: string
    defaultCurrency: string
  }>
  locales: Array<{ marketId: string; languageTag: string; isDefault: boolean }>
  currencies: Array<{ marketId: string; currencyCode: string; isDefault: boolean }>
}

function makeFakeDb(data: FakeDbData) {
  return {
    select() {
      let table: unknown
      const chain = {
        from(t: unknown) {
          table = t
          return chain
        },
        where() {
          return chain
        },
        orderBy() {
          if (table === markets) return Promise.resolve(data.markets)
          if (table === marketLocales) return Promise.resolve(data.locales)
          if (table === marketCurrencies) return Promise.resolve(data.currencies)
          return Promise.resolve([])
        },
      }
      return chain
    },
    // biome-ignore lint/suspicious/noExplicitAny: minimal drizzle-shaped stub for the read path under test.
  } as any
}

const sampleData: FakeDbData = {
  markets: [
    {
      id: "markets_ro0000000000000000000000",
      code: "RO",
      name: "Romania",
      regionCode: "EU",
      countryCode: "RO",
      defaultLanguageTag: "ro-RO",
      defaultCurrency: "RON",
    },
    {
      id: "markets_uk0000000000000000000000",
      code: "UK",
      name: "United Kingdom",
      regionCode: "EU",
      countryCode: "GB",
      defaultLanguageTag: "en-GB",
      defaultCurrency: "GBP",
    },
  ],
  locales: [
    { marketId: "markets_ro0000000000000000000000", languageTag: "ro-RO", isDefault: true },
    { marketId: "markets_ro0000000000000000000000", languageTag: "en-GB", isDefault: false },
    { marketId: "markets_uk0000000000000000000000", languageTag: "en-GB", isDefault: true },
  ],
  currencies: [
    { marketId: "markets_ro0000000000000000000000", currencyCode: "RON", isDefault: true },
    { marketId: "markets_ro0000000000000000000000", currencyCode: "EUR", isDefault: false },
    { marketId: "markets_uk0000000000000000000000", currencyCode: "GBP", isDefault: true },
  ],
}

describe("listPublicMarkets projection", () => {
  it("groups active locales + currencies under each market by code", async () => {
    const result = await listPublicMarkets(makeFakeDb(sampleData))

    expect(result).toEqual([
      {
        code: "RO",
        name: "Romania",
        regionCode: "EU",
        countryCode: "RO",
        defaultLocale: "ro-RO",
        defaultCurrency: "RON",
        locales: [
          { languageTag: "ro-RO", isDefault: true },
          { languageTag: "en-GB", isDefault: false },
        ],
        currencies: [
          { currencyCode: "RON", isDefault: true },
          { currencyCode: "EUR", isDefault: false },
        ],
      },
      {
        code: "UK",
        name: "United Kingdom",
        regionCode: "EU",
        countryCode: "GB",
        defaultLocale: "en-GB",
        defaultCurrency: "GBP",
        locales: [{ languageTag: "en-GB", isDefault: true }],
        currencies: [{ currencyCode: "GBP", isDefault: true }],
      },
    ])
  })

  it("does NOT expose admin/tenant-internal market fields", async () => {
    const [market] = await listPublicMarkets(makeFakeDb(sampleData))
    if (!market) throw new Error("expected at least one market")
    const keys = Object.keys(market)
    // Internal identifiers and finance/pricing internals must never surface.
    for (const forbidden of ["id", "status", "timezone", "taxContext", "metadata"]) {
      expect(keys).not.toContain(forbidden)
    }
    for (const locale of market.locales) {
      expect(Object.keys(locale)).toEqual(["languageTag", "isDefault"])
    }
    for (const currency of market.currencies) {
      // isSettlement / isReporting are finance-internal — omitted.
      expect(Object.keys(currency)).toEqual(["currencyCode", "isDefault"])
    }
  })

  it("returns an empty list when there are no active markets", async () => {
    const result = await listPublicMarkets(makeFakeDb({ markets: [], locales: [], currencies: [] }))
    expect(result).toEqual([])
  })
})

describe("GET /v1/public/markets route", () => {
  function mountApp(data: FakeDbData) {
    // No auth middleware: the discovery route is anonymous by construction. The
    // framework-level anonymous allow-listing is asserted in
    // packages/framework/src/anonymous-surface.test.ts.
    return new Hono<{ Variables: { db: PostgresJsDatabase } }>()
      .use("*", async (c, next) => {
        c.set("db", makeFakeDb(data))
        await next()
      })
      .route("/v1/public/markets", publicMarketsRoutes)
  }

  it("returns the supported set anonymously (no session/actor) with 200", async () => {
    const res = await mountApp(sampleData).request("/v1/public/markets")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Array<{ code: string }> }
    expect(body.data.map((m) => m.code)).toEqual(["RO", "UK"])
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300")
  })

  it("serializes only the public projection (no admin fields on the wire)", async () => {
    const res = await mountApp(sampleData).request("/v1/public/markets")
    const raw = await res.text()
    for (const forbidden of ["taxContext", "metadata", "isSettlement", "isReporting", "markets_"]) {
      expect(raw).not.toContain(forbidden)
    }
  })
})
