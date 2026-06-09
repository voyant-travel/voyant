import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { crmRoutes } from "../../src/routes/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Quote Version routes", () => {
  let app: Hono

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    const db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", crmRoutes)
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  async function seedQuote() {
    const pipRes = await app.request("/pipelines", {
      method: "POST",
      ...json({ name: `Pipeline-${Date.now()}` }),
    })
    const { data: pipeline } = await pipRes.json()

    const stgRes = await app.request("/stages", {
      method: "POST",
      ...json({ pipelineId: pipeline.id, name: `Stage-${Date.now()}` }),
    })
    const { data: stage } = await stgRes.json()

    const quoteRes = await app.request("/quotes", {
      method: "POST",
      ...json({ title: "Test Quote", pipelineId: pipeline.id, stageId: stage.id }),
    })
    const { data: quote } = await quoteRes.json()

    return { pipeline, stage, quote }
  }

  describe("Quote Versions CRUD", () => {
    it("creates a quote version", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.quoteId).toBe(quote.id)
      expect(body.data.currency).toBe("USD")
      expect(body.data.status).toBe("draft")
      expect(body.data.totalAmountCents).toBe(0)
    })

    it("lists quote versions filtered by quoteId", async () => {
      const { quote } = await seedQuote()
      await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "EUR" }),
      })

      const res = await app.request(`/quote-versions?quoteId=${quote.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(2)
    })

    it("gets a quote version by id", async () => {
      const { quote } = await seedQuote()
      const createRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "GBP" }),
      })
      const { data: quoteVersion } = await createRes.json()

      const res = await app.request(`/quote-versions/${quoteVersion.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.currency).toBe("GBP")
    })

    it("updates a quote version", async () => {
      const { quote } = await seedQuote()
      const createRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await createRes.json()

      const res = await app.request(`/quote-versions/${quoteVersion.id}`, {
        method: "PATCH",
        ...json({ status: "sent", totalAmountCents: 50000 }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("sent")
      expect(body.data.totalAmountCents).toBe(50000)
    })

    it("deletes a quote version", async () => {
      const { quote } = await seedQuote()
      const createRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await createRes.json()

      const res = await app.request(`/quote-versions/${quoteVersion.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent quote version", async () => {
      const res = await app.request("/quote-versions/crm_qver_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Quote Version Lines", () => {
    async function seedQuoteVersion() {
      const { quote } = await seedQuote()
      const quoteVersionRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await quoteVersionRes.json()
      return { quote, quoteVersion }
    }

    it("creates a quote version line", async () => {
      const { quoteVersion } = await seedQuoteVersion()

      const res = await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "Hotel Transfer", quantity: 1, currency: "USD" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.description).toBe("Hotel Transfer")
      expect(body.data.quoteVersionId).toBe(quoteVersion.id)
    })

    it("lists quote version lines", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "Line A", currency: "USD" }),
      })
      await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "Line B", currency: "USD" }),
      })

      const res = await app.request(`/quote-versions/${quoteVersion.id}/lines`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(2)
    })

    it("updates a quote version line", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      const createRes = await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "Old", currency: "USD" }),
      })
      const { data: line } = await createRes.json()

      const res = await app.request(`/quote-version-lines/${line.id}`, {
        method: "PATCH",
        ...json({ description: "Updated", quantity: 5 }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.description).toBe("Updated")
      expect(body.data.quantity).toBe(5)
    })

    it("deletes a quote version line", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      const createRes = await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "ToDelete", currency: "USD" }),
      })
      const { data: line } = await createRes.json()

      const res = await app.request(`/quote-version-lines/${line.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})
