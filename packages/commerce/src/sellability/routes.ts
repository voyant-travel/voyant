import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { sellabilityService } from "./service.js"
import {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerRefreshRunListQuerySchema,
  sellabilityExplanationListQuerySchema,
  sellabilityPersistSnapshotSchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  sellabilityResolveQuerySchema,
  sellabilitySnapshotItemListQuerySchema,
  sellabilitySnapshotListQuerySchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface SellabilityRoutesOptions {
  service?: typeof sellabilityService
}

export function createSellabilityRoutes(options: SellabilityRoutesOptions = {}) {
  const service = options.service ?? sellabilityService

  return new Hono<Env>()
    .post("/resolve", async (c) => {
      const input = await parseJsonBody(c, sellabilityResolveQuerySchema)
      return c.json(await service.resolve(c.get("db"), input))
    })
    .post("/resolve-and-persist", async (c) => {
      const input = await parseJsonBody(c, sellabilityPersistSnapshotSchema)
      return c.json(await service.persistSnapshot(c.get("db"), input), 201)
    })
    .get("/snapshots", async (c) => {
      const query = parseQuery(c, sellabilitySnapshotListQuerySchema)
      return c.json(await service.listSnapshots(c.get("db"), query))
    })
    .get("/snapshots/:id", async (c) => {
      const row = await service.getSnapshotById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability snapshot not found" }, 404)
      return c.json({ data: row })
    })
    .get("/snapshot-items", async (c) => {
      const query = parseQuery(c, sellabilitySnapshotItemListQuerySchema)
      return c.json(await service.listSnapshotItems(c.get("db"), query))
    })
    .get("/policies", async (c) => {
      const query = parseQuery(c, sellabilityPolicyListQuerySchema)
      return c.json(await service.listPolicies(c.get("db"), query))
    })
    .post("/policies", async (c) => {
      return c.json(
        {
          data: await service.createPolicy(
            c.get("db"),
            await parseJsonBody(c, insertSellabilityPolicySchema),
          ),
        },
        201,
      )
    })
    .get("/policies/:id", async (c) => {
      const row = await service.getPolicyById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/policies/:id", async (c) => {
      const row = await service.updatePolicy(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateSellabilityPolicySchema),
      )
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/policies/:id", async (c) => {
      const row = await service.deletePolicy(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ success: true })
    })
    .get("/policy-results", async (c) => {
      const query = parseQuery(c, sellabilityPolicyResultListQuerySchema)
      return c.json(await service.listPolicyResults(c.get("db"), query))
    })
    .post("/policy-results", async (c) => {
      return c.json(
        {
          data: await service.createPolicyResult(
            c.get("db"),
            await parseJsonBody(c, insertSellabilityPolicyResultSchema),
          ),
        },
        201,
      )
    })
    .get("/policy-results/:id", async (c) => {
      const row = await service.getPolicyResultById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/policy-results/:id", async (c) => {
      const row = await service.updatePolicyResult(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateSellabilityPolicyResultSchema),
      )
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/policy-results/:id", async (c) => {
      const row = await service.deletePolicyResult(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ success: true })
    })
    .get("/offer-refresh-runs", async (c) => {
      const query = parseQuery(c, offerRefreshRunListQuerySchema)
      return c.json(await service.listOfferRefreshRuns(c.get("db"), query))
    })
    .post("/offer-refresh-runs", async (c) => {
      return c.json(
        {
          data: await service.createOfferRefreshRun(
            c.get("db"),
            await parseJsonBody(c, insertOfferRefreshRunSchema),
          ),
        },
        201,
      )
    })
    .get("/offer-refresh-runs/:id", async (c) => {
      const row = await service.getOfferRefreshRunById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/offer-refresh-runs/:id", async (c) => {
      const row = await service.updateOfferRefreshRun(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateOfferRefreshRunSchema),
      )
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/offer-refresh-runs/:id", async (c) => {
      const row = await service.deleteOfferRefreshRun(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ success: true })
    })
    .get("/offer-expiration-events", async (c) => {
      const query = parseQuery(c, offerExpirationEventListQuerySchema)
      return c.json(await service.listOfferExpirationEvents(c.get("db"), query))
    })
    .post("/offer-expiration-events", async (c) => {
      return c.json(
        {
          data: await service.createOfferExpirationEvent(
            c.get("db"),
            await parseJsonBody(c, insertOfferExpirationEventSchema),
          ),
        },
        201,
      )
    })
    .get("/offer-expiration-events/:id", async (c) => {
      const row = await service.getOfferExpirationEventById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/offer-expiration-events/:id", async (c) => {
      const row = await service.updateOfferExpirationEvent(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateOfferExpirationEventSchema),
      )
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/offer-expiration-events/:id", async (c) => {
      const row = await service.deleteOfferExpirationEvent(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ success: true })
    })
    .get("/explanations", async (c) => {
      const query = parseQuery(c, sellabilityExplanationListQuerySchema)
      return c.json(await service.listExplanations(c.get("db"), query))
    })
    .post("/explanations", async (c) => {
      return c.json(
        {
          data: await service.createExplanation(
            c.get("db"),
            await parseJsonBody(c, insertSellabilityExplanationSchema),
          ),
        },
        201,
      )
    })
    .get("/explanations/:id", async (c) => {
      const row = await service.getExplanationById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/explanations/:id", async (c) => {
      const row = await service.updateExplanation(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateSellabilityExplanationSchema),
      )
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/explanations/:id", async (c) => {
      const row = await service.deleteExplanation(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ success: true })
    })
}

export const sellabilityRoutes = createSellabilityRoutes()

export type SellabilityRoutes = typeof sellabilityRoutes
