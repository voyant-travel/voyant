import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createQuotesRoutes } from "../../src/routes/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Quote routes", () => {
  let app: Hono
  const existingPersonIds = new Set<string>()

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    const db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route(
      "/",
      createQuotesRoutes({
        resolveParticipantPersonById: async (_db, personId) => existingPersonIds.has(personId),
      }),
    )
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(createTestDb())
    existingPersonIds.clear()
  })

  async function seedPipelineAndStage() {
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

    return { pipeline, stage }
  }

  async function seedQuote() {
    const { pipeline, stage } = await seedPipelineAndStage()
    const res = await app.request("/quotes", {
      method: "POST",
      ...json({ title: "Test Quote", pipelineId: pipeline.id, stageId: stage.id }),
    })
    const { data: quote } = await res.json()
    return { pipeline, stage, quote }
  }

  describe("Quotes CRUD", () => {
    it("creates a quote", async () => {
      const { pipeline, stage } = await seedPipelineAndStage()

      const res = await app.request("/quotes", {
        method: "POST",
        ...json({ title: "Big Deal", pipelineId: pipeline.id, stageId: stage.id }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.title).toBe("Big Deal")
      expect(body.data.status).toBe("open")
      expect(body.data.id).toBeTruthy()
    })

    it("lists quotes", async () => {
      await seedQuote()

      const res = await app.request("/quotes", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeTypeOf("number")
    })

    it("gets a quote by id", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Test Quote")
    })

    it("updates a quote", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}`, {
        method: "PATCH",
        ...json({ title: "Updated Deal" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Updated Deal")
    })

    it("deletes a quote", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent quote", async () => {
      const res = await app.request("/quotes/crm_quot_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates stageChangedAt when stageId changes", async () => {
      const { pipeline, quote } = await seedQuote()

      const stg2Res = await app.request("/stages", {
        method: "POST",
        ...json({ pipelineId: pipeline.id, name: `Stage2-${Date.now()}` }),
      })
      const { data: stage2 } = await stg2Res.json()

      const res = await app.request(`/quotes/${quote.id}`, {
        method: "PATCH",
        ...json({ stageId: stage2.id }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.stageId).toBe(stage2.id)
      expect(new Date(body.data.stageChangedAt).getTime()).toBeGreaterThan(
        new Date(quote.stageChangedAt).getTime(),
      )
    })

    it("sets closedAt when status changes to won", async () => {
      const { quote } = await seedQuote()

      const res = await app.request(`/quotes/${quote.id}`, {
        method: "PATCH",
        ...json({ status: "won" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("won")
      expect(body.data.closedAt).toBeTruthy()
    })

    it("clears closedAt when status changes back to open", async () => {
      const { quote } = await seedQuote()

      await app.request(`/quotes/${quote.id}`, {
        method: "PATCH",
        ...json({ status: "won" }),
      })

      const res = await app.request(`/quotes/${quote.id}`, {
        method: "PATCH",
        ...json({ status: "open" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("open")
      expect(body.data.closedAt).toBeNull()
    })
  })

  describe("Quote Participants", () => {
    it("creates and lists participants", async () => {
      const { quote } = await seedQuote()
      const personId = "pers_quote_participant_1"
      existingPersonIds.add(personId)

      const createRes = await app.request(`/quotes/${quote.id}/participants`, {
        method: "POST",
        ...json({ personId, role: "decision_maker" }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.personId).toBe(personId)
      expect(createBody.data.role).toBe("decision_maker")

      const listRes = await app.request(`/quotes/${quote.id}/participants`, {
        method: "GET",
      })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data.length).toBe(1)
    })

    it("rejects participants for missing people without inserting a row", async () => {
      const { quote } = await seedQuote()
      const missingPersonId = "missing_mr073yt6"

      const createRes = await app.request(`/quotes/${quote.id}/participants`, {
        method: "POST",
        ...json({ personId: missingPersonId, role: "traveler" }),
      })

      expect(createRes.status).toBe(400)
      const createBody = await createRes.json()
      expect(createBody.code).toBe("invalid_request")
      expect(createBody.error).toContain("personId")

      const listRes = await app.request(`/quotes/${quote.id}/participants`, {
        method: "GET",
      })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data).toEqual([])
    })

    it("deletes a participant", async () => {
      const { quote } = await seedQuote()
      const personId = "pers_quote_participant_2"
      existingPersonIds.add(personId)

      const createRes = await app.request(`/quotes/${quote.id}/participants`, {
        method: "POST",
        ...json({ personId }),
      })
      const { data: participant } = await createRes.json()

      const res = await app.request(`/quote-participants/${participant.id}`, {
        method: "DELETE",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe("Quote Products", () => {
    it("creates and lists products", async () => {
      const { quote } = await seedQuote()

      const createRes = await app.request(`/quotes/${quote.id}/products`, {
        method: "POST",
        ...json({ nameSnapshot: "Hotel Room", quantity: 2, unitPriceAmountCents: 15000 }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.nameSnapshot).toBe("Hotel Room")
      expect(createBody.data.quantity).toBe(2)

      const listRes = await app.request(`/quotes/${quote.id}/products`, {
        method: "GET",
      })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data.length).toBe(1)
    })

    it("updates a product", async () => {
      const { quote } = await seedQuote()

      const createRes = await app.request(`/quotes/${quote.id}/products`, {
        method: "POST",
        ...json({ nameSnapshot: "Old Name" }),
      })
      const { data: product } = await createRes.json()

      const res = await app.request(`/quote-products/${product.id}`, {
        method: "PATCH",
        ...json({ nameSnapshot: "New Name" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.nameSnapshot).toBe("New Name")
    })

    it("deletes a product", async () => {
      const { quote } = await seedQuote()

      const createRes = await app.request(`/quotes/${quote.id}/products`, {
        method: "POST",
        ...json({ nameSnapshot: "ToDelete" }),
      })
      const { data: product } = await createRes.json()

      const res = await app.request(`/quote-products/${product.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})
