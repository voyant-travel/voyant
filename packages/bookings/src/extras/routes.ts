import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"
import { bookingsExtrasService } from "./service.js"
import {
  bookingExtraListQuerySchema,
  insertBookingExtraSchema,
  slotExtraCollectionBulkSchema,
  slotExtraManifestQuerySchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
  updateBookingExtraSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const bookingsExtrasRoutes = new Hono<Env>()
  .get("/booking-extras", async (c) => {
    const query = await parseQuery(c, bookingExtraListQuerySchema)
    return c.json(await bookingsExtrasService.listBookingExtras(c.get("db"), query))
  })
  .post("/booking-extras", async (c) => {
    return c.json(
      {
        data: await bookingsExtrasService.createBookingExtra(
          c.get("db"),
          await parseJsonBody(c, insertBookingExtraSchema),
        ),
      },
      201,
    )
  })
  .get("/booking-extras/:id", async (c) => {
    const row = await bookingsExtrasService.getBookingExtraById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/booking-extras/:id", async (c) => {
    const row = await bookingsExtrasService.updateBookingExtra(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingExtraSchema),
    )
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/booking-extras/:id", async (c) => {
    const row = await bookingsExtrasService.deleteBookingExtra(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking extra not found" }, 404)
    return c.json({ success: true })
  })
  .get("/slot-manifests/:slotId", async (c) => {
    const query = await parseQuery(c, slotExtraManifestQuerySchema)
    const result = await bookingsExtrasService.getSlotExtraManifest(
      c.get("db"),
      c.req.param("slotId"),
      query,
    )
    if (result.status === "slot_not_found") return c.json({ error: "Slot not found" }, 404)
    return c.json({ data: result.data })
  })
  .patch("/slot-manifests/:slotId/selections", async (c) => {
    const result = await bookingsExtrasService.setSlotExtraSelection(
      c.get("db"),
      c.req.param("slotId"),
      await parseJsonBody(c, slotExtraSelectionPatchSchema),
      c.get("userId"),
    )
    return respondToManifestMutation(c, result)
  })
  .post("/slot-manifests/:slotId/selections/bulk", async (c) => {
    const result = await bookingsExtrasService.bulkSetSlotExtraSelections(
      c.get("db"),
      c.req.param("slotId"),
      await parseJsonBody(c, slotExtraSelectionBulkSchema),
      c.get("userId"),
    )
    return respondToManifestMutation(c, result)
  })
  .post("/slot-manifests/:slotId/collections/bulk", async (c) => {
    const result = await bookingsExtrasService.bulkUpdateSlotExtraCollections(
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
    | Awaited<ReturnType<typeof bookingsExtrasService.setSlotExtraSelection>>
    | Awaited<ReturnType<typeof bookingsExtrasService.bulkSetSlotExtraSelections>>
    | Awaited<ReturnType<typeof bookingsExtrasService.bulkUpdateSlotExtraCollections>>,
) {
  if (result.status === "slot_not_found") return c.json({ error: "Slot not found" }, 404)
  if (result.status === "extra_not_found") return c.json({ error: "Extra not found" }, 404)
  if (result.status === "traveler_not_found") return c.json({ error: "Traveler not found" }, 404)
  return c.json({ data: result.data })
}

export type BookingsExtrasRoutes = typeof bookingsExtrasRoutes
