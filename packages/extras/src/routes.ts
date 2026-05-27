import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"

import { extrasService } from "./service.js"
import {
  bookingExtraListQuerySchema,
  insertBookingExtraSchema,
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigListQuerySchema,
  productExtraListQuerySchema,
  slotExtraCollectionBulkSchema,
  slotExtraManifestQuerySchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
  updateBookingExtraSchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const extrasRoutes = new Hono<Env>()
  .get("/product-extras", async (c) => {
    const query = await parseQuery(c, productExtraListQuerySchema)
    return c.json(await extrasService.listProductExtras(c.get("db"), query))
  })
  .post("/product-extras", async (c) => {
    return c.json(
      {
        data: await extrasService.createProductExtra(
          c.get("db"),
          await parseJsonBody(c, insertProductExtraSchema),
        ),
      },
      201,
    )
  })
  .get("/product-extras/:id", async (c) => {
    const row = await extrasService.getProductExtraById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/product-extras/:id", async (c) => {
    const row = await extrasService.updateProductExtra(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductExtraSchema),
    )
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/product-extras/:id", async (c) => {
    const row = await extrasService.deleteProductExtra(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ success: true })
  })
  .get("/option-extra-configs", async (c) => {
    const query = await parseQuery(c, optionExtraConfigListQuerySchema)
    return c.json(await extrasService.listOptionExtraConfigs(c.get("db"), query))
  })
  .post("/option-extra-configs", async (c) => {
    return c.json(
      {
        data: await extrasService.createOptionExtraConfig(
          c.get("db"),
          await parseJsonBody(c, insertOptionExtraConfigSchema),
        ),
      },
      201,
    )
  })
  .get("/option-extra-configs/:id", async (c) => {
    const row = await extrasService.getOptionExtraConfigById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/option-extra-configs/:id", async (c) => {
    const row = await extrasService.updateOptionExtraConfig(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateOptionExtraConfigSchema),
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/option-extra-configs/:id", async (c) => {
    const row = await extrasService.deleteOptionExtraConfig(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ success: true })
  })
  .get("/booking-extras", async (c) => {
    const query = await parseQuery(c, bookingExtraListQuerySchema)
    return c.json(await extrasService.listBookingExtras(c.get("db"), query))
  })
  .post("/booking-extras", async (c) => {
    return c.json(
      {
        data: await extrasService.createBookingExtra(
          c.get("db"),
          await parseJsonBody(c, insertBookingExtraSchema),
        ),
      },
      201,
    )
  })
  .get("/booking-extras/:id", async (c) => {
    const row = await extrasService.getBookingExtraById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/booking-extras/:id", async (c) => {
    const row = await extrasService.updateBookingExtra(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingExtraSchema),
    )
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/booking-extras/:id", async (c) => {
    const row = await extrasService.deleteBookingExtra(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ success: true })
  })
  .get("/slot-manifests/:slotId", async (c) => {
    const query = await parseQuery(c, slotExtraManifestQuerySchema)
    const result = await extrasService.getSlotExtraManifest(
      c.get("db"),
      c.req.param("slotId"),
      query,
    )
    if (result.status === "slot_not_found") return c.json({ error: "Slot not found" }, 404)
    return c.json({ data: result.data })
  })
  .patch("/slot-manifests/:slotId/selections", async (c) => {
    const result = await extrasService.setSlotExtraSelection(
      c.get("db"),
      c.req.param("slotId"),
      await parseJsonBody(c, slotExtraSelectionPatchSchema),
      c.get("userId"),
    )
    return respondToManifestMutation(c, result)
  })
  .post("/slot-manifests/:slotId/selections/bulk", async (c) => {
    const result = await extrasService.bulkSetSlotExtraSelections(
      c.get("db"),
      c.req.param("slotId"),
      await parseJsonBody(c, slotExtraSelectionBulkSchema),
      c.get("userId"),
    )
    return respondToManifestMutation(c, result)
  })
  .post("/slot-manifests/:slotId/collections/bulk", async (c) => {
    const result = await extrasService.bulkUpdateSlotExtraCollections(
      c.get("db"),
      c.req.param("slotId"),
      await parseJsonBody(c, slotExtraCollectionBulkSchema),
      c.get("userId"),
    )
    return respondToManifestMutation(c, result)
  })

function respondToManifestMutation(
  c: Context<Env>,
  result:
    | Awaited<ReturnType<typeof extrasService.setSlotExtraSelection>>
    | Awaited<ReturnType<typeof extrasService.bulkSetSlotExtraSelections>>
    | Awaited<ReturnType<typeof extrasService.bulkUpdateSlotExtraCollections>>,
) {
  if (result.status === "slot_not_found") return c.json({ error: "Slot not found" }, 404)
  if (result.status === "extra_not_found") return c.json({ error: "Extra not found" }, 404)
  if (result.status === "traveler_not_found") return c.json({ error: "Traveler not found" }, 404)
  return c.json({ data: result.data })
}

export type ExtrasRoutes = typeof extrasRoutes
