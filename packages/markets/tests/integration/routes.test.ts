import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextSeq() {
  seq++
  return String(seq).padStart(4, "0")
}

describe.skipIf(!DB_AVAILABLE)("Markets routes (integration)", () => {
  let app: Hono
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: markets; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    const { marketsRoutes } = await import("../../src/routes.js")

    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", marketsRoutes)
  })

  beforeEach(async () => {
    seq = 0
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  /* ── seed helpers ─────────────────────────────────────── */

  async function seedMarket(overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/markets", {
      method: "POST",
      ...json({
        code: `MKT-${s}`,
        name: `Market ${s}`,
        defaultLanguageTag: "en",
        defaultCurrency: "USD",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedMarketLocale(marketId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request(`/markets/${marketId}/locales`, {
      method: "POST",
      ...json({
        languageTag: `en-${s.slice(2)}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedMarketCurrency(marketId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const currencies = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK"]
    const idx = (Number.parseInt(s, 10) - 1) % currencies.length
    const res = await app.request(`/markets/${marketId}/currencies`, {
      method: "POST",
      ...json({
        currencyCode: currencies[idx] ?? "EUR",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedFxRateSet(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/fx-rate-sets", {
      method: "POST",
      ...json({
        baseCurrency: "USD",
        effectiveAt: "2025-01-15T00:00:00Z",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedExchangeRate(fxRateSetId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const currencies = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK"]
    const idx = (Number.parseInt(s, 10) - 1) % currencies.length
    const res = await app.request(`/fx-rate-sets/${fxRateSetId}/exchange-rates`, {
      method: "POST",
      ...json({
        baseCurrency: "USD",
        quoteCurrency: currencies[idx] ?? "EUR",
        rateDecimal: "1.08500000",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedMarketPriceCatalog(marketId: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request("/price-catalogs", {
      method: "POST",
      ...json({
        marketId,
        priceCatalogId: `prca_fake_${nextSeq()}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  /** Seed a product row directly into DB (cross-module, no routes) */
  async function seedProductDirect() {
    const { products } = await import("@voyantjs/products/schema")
    const [row] = await db
      .insert(products)
      .values({ name: `Product ${nextSeq()}`, sellCurrency: "USD" })
      .returning()
    return row
  }

  /** Seed a channel row directly into DB (cross-module, no routes) */
  async function seedChannelDirect() {
    const { channels } = await import("../../../distribution/src/schema.js")
    const [row] = await db
      .insert(channels)
      .values({ name: `Channel ${nextSeq()}`, kind: "direct" })
      .returning()
    return row
  }

  async function seedMarketProductRule(
    marketId: string,
    productId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/product-rules", {
      method: "POST",
      ...json({
        marketId,
        productId,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedMarketChannelRule(
    marketId: string,
    channelId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/channel-rules", {
      method: "POST",
      ...json({
        marketId,
        channelId,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  /* ═══════════════════════════════════════════════════════
	   Markets
	   ═══════════════════════════════════════════════════════ */
  describe("Markets", () => {
    it("POST /markets → 201", async () => {
      const market = await seedMarket()
      expect(market.id).toMatch(/^mkt_/)
      expect(market.code).toBe("MKT-0001")
      expect(market.name).toBe("Market 0001")
      expect(market.defaultLanguageTag).toBe("en")
      expect(market.defaultCurrency).toBe("USD")
      expect(market.status).toBe("active")
    })

    it("GET /markets/:id → 200", async () => {
      const market = await seedMarket()
      const res = await app.request(`/markets/${market.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(market.id)
    })

    it("GET /markets/:id → 404 for missing", async () => {
      const res = await app.request("/markets/mkt_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /markets/:id → 200", async () => {
      const market = await seedMarket()
      const res = await app.request(`/markets/${market.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Market", status: "inactive" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("Updated Market")
      expect(body.data.status).toBe("inactive")
    })

    it("PATCH /markets/:id → 404 for missing", async () => {
      const res = await app.request("/markets/mkt_nonexistent", {
        method: "PATCH",
        ...json({ name: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /markets/:id → 200", async () => {
      const market = await seedMarket()
      const res = await app.request(`/markets/${market.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/markets/${market.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /markets/:id → 404 for missing", async () => {
      const res = await app.request("/markets/mkt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /markets → list with pagination", async () => {
      await seedMarket()
      await seedMarket()
      const res = await app.request("/markets?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /markets → filter by status", async () => {
      await seedMarket({ status: "active" })
      await seedMarket({ status: "inactive" })
      const res = await app.request("/markets?status=inactive")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("inactive")
    })

    it("GET /markets → filter by countryCode", async () => {
      await seedMarket({ countryCode: "US" })
      await seedMarket({ countryCode: "GB" })
      const res = await app.request("/markets?countryCode=US")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].countryCode).toBe("US")
    })

    it("GET /markets → search by name", async () => {
      await seedMarket({ name: "Alpha Market" })
      await seedMarket({ name: "Beta Market" })
      const res = await app.request("/markets?search=Alpha")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe("Alpha Market")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Market Locales
	   ═══════════════════════════════════════════════════════ */
  describe("Market Locales", () => {
    it("POST /markets/:id/locales → 201", async () => {
      const market = await seedMarket()
      const locale = await seedMarketLocale(market.id, { languageTag: "fr" })
      expect(locale.id).toMatch(/^mklo_/)
      expect(locale.marketId).toBe(market.id)
      expect(locale.languageTag).toBe("fr")
      expect(locale.isDefault).toBe(false)
      expect(locale.active).toBe(true)
    })

    it("POST /markets/:id/locales → 404 for missing market", async () => {
      const res = await app.request("/markets/mkt_nonexistent/locales", {
        method: "POST",
        ...json({ languageTag: "fr" }),
      })
      expect(res.status).toBe(404)
    })

    it("PATCH /market-locales/:id → 200", async () => {
      const market = await seedMarket()
      const locale = await seedMarketLocale(market.id, { languageTag: "de" })
      const res = await app.request(`/market-locales/${locale.id}`, {
        method: "PATCH",
        ...json({ isDefault: true, sortOrder: 5 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isDefault).toBe(true)
      expect(body.data.sortOrder).toBe(5)
    })

    it("PATCH /market-locales/:id → 404 for missing", async () => {
      const res = await app.request("/market-locales/mklo_nonexistent", {
        method: "PATCH",
        ...json({ isDefault: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /market-locales/:id → 200", async () => {
      const market = await seedMarket()
      const locale = await seedMarketLocale(market.id, { languageTag: "es" })
      const res = await app.request(`/market-locales/${locale.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /market-locales/:id → 404 for missing", async () => {
      const res = await app.request("/market-locales/mklo_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /market-locales → list with filters", async () => {
      const m1 = await seedMarket()
      const m2 = await seedMarket()
      await seedMarketLocale(m1.id, { languageTag: "en" })
      await seedMarketLocale(m1.id, { languageTag: "fr" })
      await seedMarketLocale(m2.id, { languageTag: "de" })

      const res = await app.request(`/market-locales?marketId=${m1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /market-locales → filter by languageTag", async () => {
      const market = await seedMarket()
      await seedMarketLocale(market.id, { languageTag: "en" })
      await seedMarketLocale(market.id, { languageTag: "fr" })
      const res = await app.request("/market-locales?languageTag=fr")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].languageTag).toBe("fr")
    })

    it("GET /market-locales → filter by active", async () => {
      const market = await seedMarket()
      await seedMarketLocale(market.id, { languageTag: "en", active: true })
      await seedMarketLocale(market.id, { languageTag: "fr", active: false })
      const res = await app.request("/market-locales?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Market Currencies
	   ═══════════════════════════════════════════════════════ */
  describe("Market Currencies", () => {
    it("POST /markets/:id/currencies → 201", async () => {
      const market = await seedMarket()
      const currency = await seedMarketCurrency(market.id, { currencyCode: "EUR" })
      expect(currency.id).toMatch(/^mkcu_/)
      expect(currency.marketId).toBe(market.id)
      expect(currency.currencyCode).toBe("EUR")
      expect(currency.isDefault).toBe(false)
      expect(currency.active).toBe(true)
    })

    it("POST /markets/:id/currencies → 404 for missing market", async () => {
      const res = await app.request("/markets/mkt_nonexistent/currencies", {
        method: "POST",
        ...json({ currencyCode: "EUR" }),
      })
      expect(res.status).toBe(404)
    })

    it("PATCH /market-currencies/:id → 200", async () => {
      const market = await seedMarket()
      const currency = await seedMarketCurrency(market.id, { currencyCode: "GBP" })
      const res = await app.request(`/market-currencies/${currency.id}`, {
        method: "PATCH",
        ...json({ isDefault: true, isSettlement: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isDefault).toBe(true)
      expect(body.data.isSettlement).toBe(true)
    })

    it("PATCH /market-currencies/:id → 404 for missing", async () => {
      const res = await app.request("/market-currencies/mkcu_nonexistent", {
        method: "PATCH",
        ...json({ isDefault: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /market-currencies/:id → 200", async () => {
      const market = await seedMarket()
      const currency = await seedMarketCurrency(market.id, { currencyCode: "JPY" })
      const res = await app.request(`/market-currencies/${currency.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /market-currencies/:id → 404 for missing", async () => {
      const res = await app.request("/market-currencies/mkcu_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /market-currencies → list with filters", async () => {
      const m1 = await seedMarket()
      const m2 = await seedMarket()
      await seedMarketCurrency(m1.id, { currencyCode: "EUR" })
      await seedMarketCurrency(m1.id, { currencyCode: "GBP" })
      await seedMarketCurrency(m2.id, { currencyCode: "JPY" })

      const res = await app.request(`/market-currencies?marketId=${m1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /market-currencies → filter by currencyCode", async () => {
      const market = await seedMarket()
      await seedMarketCurrency(market.id, { currencyCode: "EUR" })
      await seedMarketCurrency(market.id, { currencyCode: "GBP" })
      const res = await app.request("/market-currencies?currencyCode=GBP")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].currencyCode).toBe("GBP")
    })

    it("GET /market-currencies → filter by active", async () => {
      const market = await seedMarket()
      await seedMarketCurrency(market.id, { currencyCode: "EUR", active: true })
      await seedMarketCurrency(market.id, { currencyCode: "GBP", active: false })
      const res = await app.request("/market-currencies?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   FX Rate Sets
	   ═══════════════════════════════════════════════════════ */
  describe("FX Rate Sets", () => {
    it("POST /fx-rate-sets → 201", async () => {
      const rateSet = await seedFxRateSet()
      expect(rateSet.id).toMatch(/^fxrs_/)
      expect(rateSet.baseCurrency).toBe("USD")
      expect(rateSet.source).toBe("manual")
    })

    it("GET /fx-rate-sets/:id → 200", async () => {
      const rateSet = await seedFxRateSet()
      const res = await app.request(`/fx-rate-sets/${rateSet.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(rateSet.id)
    })

    it("GET /fx-rate-sets/:id → 404 for missing", async () => {
      const res = await app.request("/fx-rate-sets/fxrs_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /fx-rate-sets/:id → 200", async () => {
      const rateSet = await seedFxRateSet()
      const res = await app.request(`/fx-rate-sets/${rateSet.id}`, {
        method: "PATCH",
        ...json({ source: "ecb", notes: "Updated via ECB" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.source).toBe("ecb")
      expect(body.data.notes).toBe("Updated via ECB")
    })

    it("PATCH /fx-rate-sets/:id → 404 for missing", async () => {
      const res = await app.request("/fx-rate-sets/fxrs_nonexistent", {
        method: "PATCH",
        ...json({ source: "ecb" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /fx-rate-sets/:id → 200", async () => {
      const rateSet = await seedFxRateSet()
      const res = await app.request(`/fx-rate-sets/${rateSet.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/fx-rate-sets/${rateSet.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /fx-rate-sets/:id → 404 for missing", async () => {
      const res = await app.request("/fx-rate-sets/fxrs_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /fx-rate-sets → list with pagination", async () => {
      await seedFxRateSet({ baseCurrency: "USD", effectiveAt: "2025-01-01T00:00:00Z" })
      await seedFxRateSet({ baseCurrency: "EUR", effectiveAt: "2025-02-01T00:00:00Z" })
      const res = await app.request("/fx-rate-sets?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /fx-rate-sets → filter by source", async () => {
      await seedFxRateSet({ source: "manual" })
      await seedFxRateSet({ source: "ecb" })
      const res = await app.request("/fx-rate-sets?source=ecb")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].source).toBe("ecb")
    })

    it("GET /fx-rate-sets → filter by baseCurrency", async () => {
      await seedFxRateSet({ baseCurrency: "USD" })
      await seedFxRateSet({ baseCurrency: "EUR" })
      const res = await app.request("/fx-rate-sets?baseCurrency=EUR")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].baseCurrency).toBe("EUR")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Exchange Rates
	   ═══════════════════════════════════════════════════════ */
})
