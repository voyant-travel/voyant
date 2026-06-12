import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Hono } from "hono"
import { z } from "zod"

import { parseUnifiedKey } from "./lib/key.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { adapterNotRegistered, invalidKey, resolveExternal } from "./routes-keying.js"
import { cruisesService } from "./service.js"
import {
  insertCabinCategorySchema,
  insertCabinSchema,
  insertDeckSchema,
  insertShipSchema,
  shipListQuerySchema,
  updateCabinCategorySchema,
  updateCabinSchema,
  updateDeckSchema,
  updateShipSchema,
} from "./validation-cabins.js"

export function registerCruiseShipRoutes(app: Hono<Env>) {
  app
    // --- ships ---
    .get("/ships", async (c) => {
      const query = parseQuery(c, shipListQuerySchema)
      const result = await cruisesService.listShips(c.get("db"), query)
      return c.json(result)
    })
    .post("/ships", async (c) => {
      const data = await parseJsonBody(c, insertShipSchema)
      const row = await cruisesService.createShip(c.get("db"), data)
      return c.json({ data: row }, 201)
    })
    .get("/ships/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const ship = await ext.adapter.fetchShip(ext.sourceRef)
        if (!ship) return c.json({ error: "not_found" }, 404)
        return c.json({
          data: {
            source: "external",
            sourceProvider: ext.adapter.name,
            sourceRef: ship.sourceRef,
            ship,
          },
        })
      }
      const row = await cruisesService.getShipById(c.get("db"), parsed.id)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .put("/ships/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const data = await parseJsonBody(c, updateShipSchema)
      const row = await cruisesService.updateShip(c.get("db"), parsed.id, data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/ships/:key/decks", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const ship = await ext.adapter.fetchShip(ext.sourceRef)
        return c.json({ data: ship?.decks ?? [] })
      }
      const decks = await cruisesService.listShipDecks(c.get("db"), parsed.id)
      return c.json({ data: decks })
    })
    .post("/ships/:key/decks", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const data = await parseJsonBody(c, insertDeckSchema.omit({ shipId: true }))
      const row = await cruisesService.upsertDeck(c.get("db"), { ...data, shipId: parsed.id })
      return c.json({ data: row }, 201)
    })
    .put("/decks/:deckId", async (c) => {
      const data = await parseJsonBody(c, updateDeckSchema)
      const row = await cruisesService.updateDeck(c.get("db"), c.req.param("deckId"), data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/ships/:key/categories", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const ship = await ext.adapter.fetchShip(ext.sourceRef)
        return c.json({ data: ship?.categories ?? [] })
      }
      const categories = await cruisesService.listShipCabinCategories(c.get("db"), parsed.id)
      return c.json({ data: categories })
    })
    .put("/ships/:key/categories/bulk", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const payload = await parseJsonBody(
        c,
        z.object({ categories: z.array(insertCabinCategorySchema) }),
      )
      const out: Awaited<ReturnType<typeof cruisesService.upsertCabinCategory>>[] = []
      for (const cat of payload.categories) {
        const row = await cruisesService.upsertCabinCategory(c.get("db"), {
          ...cat,
          shipId: parsed.id,
        })
        out.push(row)
      }
      return c.json({ data: out })
    })
    .put("/categories/:categoryId", async (c) => {
      const data = await parseJsonBody(c, updateCabinCategorySchema)
      const row = await cruisesService.updateCabinCategory(
        c.get("db"),
        c.req.param("categoryId"),
        data,
      )
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/categories/:categoryId/cabins", async (c) => {
      const cabins = await cruisesService.listCabinsByCategory(
        c.get("db"),
        c.req.param("categoryId"),
      )
      return c.json({ data: cabins })
    })
    .put("/categories/:categoryId/cabins/bulk", async (c) => {
      const categoryId = c.req.param("categoryId")
      const payload = await parseJsonBody(
        c,
        z.object({ cabins: z.array(insertCabinSchema.omit({ categoryId: true })) }),
      )
      const out: Awaited<ReturnType<typeof cruisesService.upsertCabin>>[] = []
      for (const cabin of payload.cabins) {
        const row = await cruisesService.upsertCabin(c.get("db"), { ...cabin, categoryId })
        out.push(row)
      }
      return c.json({ data: out })
    })
    .put("/cabins/:cabinId", async (c) => {
      const data = await parseJsonBody(c, updateCabinSchema)
      const row = await cruisesService.updateCabin(c.get("db"), c.req.param("cabinId"), data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
}
