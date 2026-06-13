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

  describe("Exchange Rates", () => {
    it("POST /fx-rate-sets/:id/exchange-rates → 201", async () => {
      const rateSet = await seedFxRateSet()
      const rate = await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rateDecimal: "0.92000000",
      })
      expect(rate.id).toMatch(/^fxrt_/)
      expect(rate.fxRateSetId).toBe(rateSet.id)
      expect(rate.baseCurrency).toBe("USD")
      expect(rate.quoteCurrency).toBe("EUR")
      expect(rate.rateDecimal).toBe("0.92000000")
    })

    it("POST /fx-rate-sets/:id/exchange-rates → 404 for missing rate set", async () => {
      const res = await app.request("/fx-rate-sets/fxrs_nonexistent/exchange-rates", {
        method: "POST",
        ...json({
          baseCurrency: "USD",
          quoteCurrency: "EUR",
          rateDecimal: "0.92000000",
        }),
      })
      expect(res.status).toBe(404)
    })

    it("PATCH /exchange-rates/:id → 200", async () => {
      const rateSet = await seedFxRateSet()
      const rate = await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "GBP",
        rateDecimal: "0.79000000",
      })
      const res = await app.request(`/exchange-rates/${rate.id}`, {
        method: "PATCH",
        ...json({ rateDecimal: "0.80500000" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.rateDecimal).toBe("0.80500000")
    })

    it("PATCH /exchange-rates/:id → 404 for missing", async () => {
      const res = await app.request("/exchange-rates/fxrt_nonexistent", {
        method: "PATCH",
        ...json({ rateDecimal: "1.00000000" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /exchange-rates/:id → 200", async () => {
      const rateSet = await seedFxRateSet()
      const rate = await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "CHF",
        rateDecimal: "0.88000000",
      })
      const res = await app.request(`/exchange-rates/${rate.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /exchange-rates/:id → 404 for missing", async () => {
      const res = await app.request("/exchange-rates/fxrt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /exchange-rates → list with filters", async () => {
      const rs1 = await seedFxRateSet()
      const rs2 = await seedFxRateSet({ baseCurrency: "EUR" })
      await seedExchangeRate(rs1.id, {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rateDecimal: "0.92000000",
      })
      await seedExchangeRate(rs1.id, {
        baseCurrency: "USD",
        quoteCurrency: "GBP",
        rateDecimal: "0.79000000",
      })
      await seedExchangeRate(rs2.id, {
        baseCurrency: "EUR",
        quoteCurrency: "JPY",
        rateDecimal: "162.50000000",
      })

      const res = await app.request(`/exchange-rates?fxRateSetId=${rs1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /exchange-rates → filter by baseCurrency", async () => {
      const rateSet = await seedFxRateSet()
      await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rateDecimal: "0.92000000",
      })
      await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "GBP",
        rateDecimal: "0.79000000",
      })

      const res = await app.request("/exchange-rates?baseCurrency=USD")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it("GET /exchange-rates → filter by quoteCurrency", async () => {
      const rateSet = await seedFxRateSet()
      await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rateDecimal: "0.92000000",
      })
      await seedExchangeRate(rateSet.id, {
        baseCurrency: "USD",
        quoteCurrency: "GBP",
        rateDecimal: "0.79000000",
      })

      const res = await app.request("/exchange-rates?quoteCurrency=EUR")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].quoteCurrency).toBe("EUR")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Market Price Catalogs
	   ═══════════════════════════════════════════════════════ */
  describe("Market Price Catalogs", () => {
    it("POST /price-catalogs → 201", async () => {
      const market = await seedMarket()
      const catalog = await seedMarketPriceCatalog(market.id)
      expect(catalog.id).toMatch(/^mkpc_/)
      expect(catalog.marketId).toBe(market.id)
      expect(catalog.isDefault).toBe(false)
      expect(catalog.active).toBe(true)
    })

    it("POST /price-catalogs → 404 for missing market", async () => {
      const res = await app.request("/price-catalogs", {
        method: "POST",
        ...json({ marketId: "mkt_nonexistent", priceCatalogId: "prca_fake_9999" }),
      })
      expect(res.status).toBe(404)
    })

    it("GET /price-catalogs/:id → 200", async () => {
      const market = await seedMarket()
      const catalog = await seedMarketPriceCatalog(market.id)
      const res = await app.request(`/price-catalogs/${catalog.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(catalog.id)
    })

    it("GET /price-catalogs/:id → 404 for missing", async () => {
      const res = await app.request("/price-catalogs/mkpc_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /price-catalogs/:id → 200", async () => {
      const market = await seedMarket()
      const catalog = await seedMarketPriceCatalog(market.id)
      const res = await app.request(`/price-catalogs/${catalog.id}`, {
        method: "PATCH",
        ...json({ isDefault: true, priority: 10 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isDefault).toBe(true)
      expect(body.data.priority).toBe(10)
    })

    it("PATCH /price-catalogs/:id → 404 for missing", async () => {
      const res = await app.request("/price-catalogs/mkpc_nonexistent", {
        method: "PATCH",
        ...json({ isDefault: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /price-catalogs/:id → 200", async () => {
      const market = await seedMarket()
      const catalog = await seedMarketPriceCatalog(market.id)
      const res = await app.request(`/price-catalogs/${catalog.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /price-catalogs/:id → 404 for missing", async () => {
      const res = await app.request("/price-catalogs/mkpc_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /price-catalogs → list with filters", async () => {
      const m1 = await seedMarket()
      const m2 = await seedMarket()
      await seedMarketPriceCatalog(m1.id)
      await seedMarketPriceCatalog(m1.id)
      await seedMarketPriceCatalog(m2.id)

      const res = await app.request(`/price-catalogs?marketId=${m1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /price-catalogs → filter by active", async () => {
      const market = await seedMarket()
      await seedMarketPriceCatalog(market.id, { active: true })
      await seedMarketPriceCatalog(market.id, { active: false })

      const res = await app.request("/price-catalogs?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Market Product Rules
	   ═══════════════════════════════════════════════════════ */
  describe("Market Product Rules", () => {
    it("POST /product-rules → 201", async () => {
      const market = await seedMarket()
      const product = await seedProductDirect()
      const rule = await seedMarketProductRule(market.id, product.id)
      expect(rule.id).toMatch(/^mkpr_/)
      expect(rule.marketId).toBe(market.id)
      expect(rule.productId).toBe(product.id)
      expect(rule.visibility).toBe("public")
      expect(rule.sellability).toBe("sellable")
      expect(rule.channelScope).toBe("all")
      expect(rule.active).toBe(true)
    })

    it("POST /product-rules → 404 for missing market", async () => {
      const product = await seedProductDirect()
      const res = await app.request("/product-rules", {
        method: "POST",
        ...json({ marketId: "mkt_nonexistent", productId: product.id }),
      })
      expect(res.status).toBe(404)
    })

    it("GET /product-rules/:id → 200", async () => {
      const market = await seedMarket()
      const product = await seedProductDirect()
      const rule = await seedMarketProductRule(market.id, product.id)
      const res = await app.request(`/product-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(rule.id)
    })

    it("GET /product-rules/:id → 404 for missing", async () => {
      const res = await app.request("/product-rules/mkpr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /product-rules/:id → 200", async () => {
      const market = await seedMarket()
      const product = await seedProductDirect()
      const rule = await seedMarketProductRule(market.id, product.id)
      const res = await app.request(`/product-rules/${rule.id}`, {
        method: "PATCH",
        ...json({
          visibility: "private",
          sellability: "on_request",
          channelScope: "b2b",
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.visibility).toBe("private")
      expect(body.data.sellability).toBe("on_request")
      expect(body.data.channelScope).toBe("b2b")
    })

    it("PATCH /product-rules/:id → 404 for missing", async () => {
      const res = await app.request("/product-rules/mkpr_nonexistent", {
        method: "PATCH",
        ...json({ visibility: "hidden" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /product-rules/:id → 200", async () => {
      const market = await seedMarket()
      const product = await seedProductDirect()
      const rule = await seedMarketProductRule(market.id, product.id)
      const res = await app.request(`/product-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /product-rules/:id → 404 for missing", async () => {
      const res = await app.request("/product-rules/mkpr_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /product-rules → list with filters", async () => {
      const market = await seedMarket()
      const p1 = await seedProductDirect()
      const p2 = await seedProductDirect()
      await seedMarketProductRule(market.id, p1.id)
      await seedMarketProductRule(market.id, p2.id)

      const res = await app.request(`/product-rules?marketId=${market.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /product-rules → filter by productId", async () => {
      const market = await seedMarket()
      const p1 = await seedProductDirect()
      const p2 = await seedProductDirect()
      await seedMarketProductRule(market.id, p1.id)
      await seedMarketProductRule(market.id, p2.id)

      const res = await app.request(`/product-rules?productId=${p1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].productId).toBe(p1.id)
    })

    it("GET /product-rules → filter by sellability", async () => {
      const market = await seedMarket()
      const p1 = await seedProductDirect()
      const p2 = await seedProductDirect()
      await seedMarketProductRule(market.id, p1.id, { sellability: "sellable" })
      await seedMarketProductRule(market.id, p2.id, { sellability: "on_request" })

      const res = await app.request("/product-rules?sellability=on_request")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].sellability).toBe("on_request")
    })

    it("GET /product-rules → filter by active", async () => {
      const market = await seedMarket()
      const p1 = await seedProductDirect()
      const p2 = await seedProductDirect()
      await seedMarketProductRule(market.id, p1.id, { active: true })
      await seedMarketProductRule(market.id, p2.id, { active: false })

      const res = await app.request("/product-rules?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Market Channel Rules
	   ═══════════════════════════════════════════════════════ */
})
