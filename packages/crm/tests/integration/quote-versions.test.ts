// agent-quality: file-size exception -- owner: crm; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
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

  async function seedQuoteVersion() {
    const { quote } = await seedQuote()
    const quoteVersionRes = await app.request(`/quotes/${quote.id}/versions`, {
      method: "POST",
      ...json({ currency: "USD" }),
    })
    const { data: quoteVersion } = await quoteVersionRes.json()
    return { quote, quoteVersion }
  }

  async function applySnapshot(quoteVersionId: string, overrides: Record<string, unknown> = {}) {
    return app.request(`/quote-versions/${quoteVersionId}/trip-snapshot`, {
      method: "POST",
      ...json({
        tripSnapshotId: `trsn_${Date.now()}`,
        currency: "EUR",
        subtotalAmountCents: 10000,
        taxAmountCents: 900,
        totalAmountCents: 10900,
        lines: [
          {
            componentId: "trcp_123",
            description: "Airport transfer",
            quantity: 1,
            unitPriceAmountCents: 10000,
            totalAmountCents: 10900,
            currency: "EUR",
          },
        ],
        ...overrides,
      }),
    })
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
        ...json({ totalAmountCents: 50000 }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("draft")
      expect(body.data.totalAmountCents).toBe(50000)
    })

    it("rejects generic quote version status updates", async () => {
      const { quote } = await seedQuote()
      const createRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await createRes.json()

      const res = await app.request(`/quote-versions/${quoteVersion.id}`, {
        method: "PATCH",
        ...json({ status: "sent" }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("lifecycle")
    })

    it("rejects creating non-draft quote versions through the CRUD route", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD", status: "accepted" }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("draft")
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

    it("rejects deleting non-draft quote versions", async () => {
      const { quote } = await seedQuote()
      const createRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await createRes.json()
      await applySnapshot(quoteVersion.id)
      await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const res = await app.request(`/quote-versions/${quoteVersion.id}`, { method: "DELETE" })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("draft")
    })

    it("returns 404 for non-existent quote version", async () => {
      const res = await app.request("/quote-versions/crm_qver_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Quote Version Lines", () => {
    it("applies a trip snapshot read model to a quote version", async () => {
      const { quoteVersion } = await seedQuoteVersion()

      const res = await app.request(`/quote-versions/${quoteVersion.id}/trip-snapshot`, {
        method: "POST",
        ...json({
          tripSnapshotId: "trsn_snapshot_1",
          currency: "EUR",
          subtotalAmountCents: 10000,
          taxAmountCents: 900,
          totalAmountCents: 10900,
          lines: [
            {
              componentId: "trcp_123",
              description: "Airport transfer",
              quantity: 1,
              unitPriceAmountCents: 10000,
              totalAmountCents: 10900,
              currency: "EUR",
            },
          ],
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.quoteVersion.tripSnapshotId).toBe("trsn_snapshot_1")
      expect(body.data.quoteVersion.totalAmountCents).toBe(10900)
      expect(body.data.lines).toHaveLength(1)
      expect(body.data.lines[0].description).toBe("Airport transfer")
    })

    it("rejects applying a trip snapshot to a non-draft quote version", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      await applySnapshot(quoteVersion.id)
      await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const res = await app.request(`/quote-versions/${quoteVersion.id}/trip-snapshot`, {
        method: "POST",
        ...json({
          tripSnapshotId: "trsn_snapshot_1",
          currency: "EUR",
          subtotalAmountCents: 10000,
          taxAmountCents: 900,
          totalAmountCents: 10900,
          lines: [],
        }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("draft")
    })

    it("requires a trip snapshot before sending a quote version", async () => {
      const { quoteVersion } = await seedQuoteVersion()

      const res = await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("Trip snapshot")
    })

    it("sends, tracks view, and declines quote versions through lifecycle routes", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      await applySnapshot(quoteVersion.id)

      const sendRes = await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })
      expect(sendRes.status).toBe(200)
      const sendBody = await sendRes.json()
      expect(sendBody.data.status).toBe("sent")
      expect(sendBody.data.sentAt).not.toBeNull()
      expect(sendBody.data.validUntil).toBe("2099-01-01")

      const viewRes = await app.request(`/quote-versions/${quoteVersion.id}/view`, {
        method: "POST",
        ...json({}),
      })
      expect(viewRes.status).toBe(200)
      const viewBody = await viewRes.json()
      expect(viewBody.data.status).toBe("sent")
      expect(viewBody.data.viewedAt).not.toBeNull()

      const declineRes = await app.request(`/quote-versions/${quoteVersion.id}/decline`, {
        method: "POST",
        ...json({}),
      })
      expect(declineRes.status).toBe(200)
      const declineBody = await declineRes.json()
      expect(declineBody.data.status).toBe("declined")
      expect(declineBody.data.decidedAt).not.toBeNull()
    })

    it("accepts one sent quote version, closes other open versions, and wins the quote", async () => {
      const { quote, quoteVersion } = await seedQuoteVersion()
      await applySnapshot(quoteVersion.id)
      await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const alternativeRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "EUR", label: "Alternative" }),
      })
      const { data: alternative } = await alternativeRes.json()
      await applySnapshot(alternative.id, { tripSnapshotId: "trsn_alternative" })
      await app.request(`/quote-versions/${alternative.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const draftRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "EUR", label: "Draft after send" }),
      })
      const { data: draft } = await draftRes.json()

      const res = await app.request(`/quote-versions/${quoteVersion.id}/accept`, {
        method: "POST",
        ...json({}),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.quoteVersion.status).toBe("accepted")
      expect(body.data.quoteVersion.decidedAt).not.toBeNull()
      expect(body.data.quote.status).toBe("won")
      expect(body.data.quote.acceptedVersionId).toBe(quoteVersion.id)
      expect(body.data.quote.valueAmountCents).toBe(10900)
      expect(body.data.quote.valueCurrency).toBe("EUR")
      expect(body.data.closedQuoteVersions.map((row: { id: string }) => row.id)).toEqual(
        expect.arrayContaining([alternative.id, draft.id]),
      )

      const alternativeGet = await app.request(`/quote-versions/${alternative.id}`, {
        method: "GET",
      })
      const alternativeBody = await alternativeGet.json()
      expect(alternativeBody.data.status).toBe("declined")

      const draftGet = await app.request(`/quote-versions/${draft.id}`, { method: "GET" })
      const draftBody = await draftGet.json()
      expect(draftBody.data.status).toBe("superseded")
    })

    it("rejects accepting a non-sent quote version", async () => {
      const { quoteVersion } = await seedQuoteVersion()

      const res = await app.request(`/quote-versions/${quoteVersion.id}/accept`, {
        method: "POST",
        ...json({}),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("sent")
    })

    it("expires sent quote versions past validUntil", async () => {
      const { quote } = await seedQuote()
      const quoteVersionRes = await app.request(`/quotes/${quote.id}/versions`, {
        method: "POST",
        ...json({ currency: "USD" }),
      })
      const { data: quoteVersion } = await quoteVersionRes.json()
      await applySnapshot(quoteVersion.id, { tripSnapshotId: "trsn_expiring" })
      await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const res = await app.request("/quote-versions/expire", {
        method: "POST",
        ...json({ now: "2100-01-02T00:00:00.000Z" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.map((row: { id: string }) => row.id)).toContain(quoteVersion.id)
      const getRes = await app.request(`/quote-versions/${quoteVersion.id}`, { method: "GET" })
      const getBody = await getRes.json()
      expect(getBody.data.status).toBe("expired")
      expect(getBody.data.decidedAt).not.toBeNull()
    })

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

    it("rejects mutating quote version lines after send", async () => {
      const { quoteVersion } = await seedQuoteVersion()
      await applySnapshot(quoteVersion.id)
      await app.request(`/quote-versions/${quoteVersion.id}/send`, {
        method: "POST",
        ...json({ validUntil: "2099-01-01" }),
      })

      const linesRes = await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "GET",
      })
      const linesBody = await linesRes.json()
      const line = linesBody.data[0]

      const createRes = await app.request(`/quote-versions/${quoteVersion.id}/lines`, {
        method: "POST",
        ...json({ description: "Late add", currency: "USD" }),
      })
      expect(createRes.status).toBe(409)

      const updateRes = await app.request(`/quote-version-lines/${line.id}`, {
        method: "PATCH",
        ...json({ description: "Late edit" }),
      })
      expect(updateRes.status).toBe(409)

      const deleteRes = await app.request(`/quote-version-lines/${line.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(409)
    })
  })
})
