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
    const { products } = await import("@voyantjs/inventory/schema")
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

  describe("Market Channel Rules", () => {
    it("POST /channel-rules → 201", async () => {
      const market = await seedMarket()
      const channel = await seedChannelDirect()
      const rule = await seedMarketChannelRule(market.id, channel.id)
      expect(rule.id).toMatch(/^mkcr_/)
      expect(rule.marketId).toBe(market.id)
      expect(rule.channelId).toBe(channel.id)
      expect(rule.visibility).toBe("public")
      expect(rule.sellability).toBe("sellable")
      expect(rule.active).toBe(true)
    })

    it("POST /channel-rules → 404 for missing market", async () => {
      const channel = await seedChannelDirect()
      const res = await app.request("/channel-rules", {
        method: "POST",
        ...json({ marketId: "mkt_nonexistent", channelId: channel.id }),
      })
      expect(res.status).toBe(404)
    })

    it("GET /channel-rules/:id → 200", async () => {
      const market = await seedMarket()
      const channel = await seedChannelDirect()
      const rule = await seedMarketChannelRule(market.id, channel.id)
      const res = await app.request(`/channel-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(rule.id)
    })

    it("GET /channel-rules/:id → 404 for missing", async () => {
      const res = await app.request("/channel-rules/mkcr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /channel-rules/:id → 200", async () => {
      const market = await seedMarket()
      const channel = await seedChannelDirect()
      const rule = await seedMarketChannelRule(market.id, channel.id)
      const res = await app.request(`/channel-rules/${rule.id}`, {
        method: "PATCH",
        ...json({
          visibility: "hidden",
          sellability: "unavailable",
          priority: 5,
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.visibility).toBe("hidden")
      expect(body.data.sellability).toBe("unavailable")
      expect(body.data.priority).toBe(5)
    })

    it("PATCH /channel-rules/:id → 404 for missing", async () => {
      const res = await app.request("/channel-rules/mkcr_nonexistent", {
        method: "PATCH",
        ...json({ visibility: "hidden" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /channel-rules/:id → 200", async () => {
      const market = await seedMarket()
      const channel = await seedChannelDirect()
      const rule = await seedMarketChannelRule(market.id, channel.id)
      const res = await app.request(`/channel-rules/${rule.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /channel-rules/:id → 404 for missing", async () => {
      const res = await app.request("/channel-rules/mkcr_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /channel-rules → list with filters", async () => {
      const market = await seedMarket()
      const ch1 = await seedChannelDirect()
      const ch2 = await seedChannelDirect()
      await seedMarketChannelRule(market.id, ch1.id)
      await seedMarketChannelRule(market.id, ch2.id)

      const res = await app.request(`/channel-rules?marketId=${market.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /channel-rules → filter by channelId", async () => {
      const market = await seedMarket()
      const ch1 = await seedChannelDirect()
      const ch2 = await seedChannelDirect()
      await seedMarketChannelRule(market.id, ch1.id)
      await seedMarketChannelRule(market.id, ch2.id)

      const res = await app.request(`/channel-rules?channelId=${ch1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].channelId).toBe(ch1.id)
    })

    it("GET /channel-rules → filter by sellability", async () => {
      const market = await seedMarket()
      const ch1 = await seedChannelDirect()
      const ch2 = await seedChannelDirect()
      await seedMarketChannelRule(market.id, ch1.id, { sellability: "sellable" })
      await seedMarketChannelRule(market.id, ch2.id, { sellability: "unavailable" })

      const res = await app.request("/channel-rules?sellability=unavailable")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].sellability).toBe("unavailable")
    })

    it("GET /channel-rules → filter by active", async () => {
      const market = await seedMarket()
      const ch1 = await seedChannelDirect()
      const ch2 = await seedChannelDirect()
      await seedMarketChannelRule(market.id, ch1.id, { active: true })
      await seedMarketChannelRule(market.id, ch2.id, { active: false })

      const res = await app.request("/channel-rules?active=false")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].active).toBe(false)
    })
  })
})
