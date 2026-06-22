/**
 * Room-block admin routes. Mounted by the deployment under
 * `/v1/admin/accommodations` (so these resolve at
 * `/v1/admin/accommodations/room-blocks/*`). The accommodations module sets
 * `requiresTransactionalDb`, so the pickup/reversal/release mutations run on
 * the transactional DB. See RFC voyant#1489 §4.2/§8.
 *
 * Routes stay thin: validate input, call `roomBlockService`, serialize.
 */

import { parseJsonBody } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import {
  createRoomBlock,
  getRoomBlock,
  pickupRoomBlock,
  releaseRoomBlockAtCutoff,
  reverseRoomBlockPickup,
  setRoomBlockNights,
  summarizeRoomBlock,
} from "./service-room-blocks.js"
import {
  createRoomBlockSchema,
  reverseRoomBlockPickupSchema,
  roomBlockPickupSchema,
  setRoomBlockNightsSchema,
} from "./validation-room-blocks.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const roomBlockAdminRoutes = new Hono<Env>()
  .post("/room-blocks", async (c) => {
    const body = await parseJsonBody(c, createRoomBlockSchema)
    return c.json({ data: await createRoomBlock(c.get("db"), body) }, 201)
  })
  .get("/room-blocks/:id", async (c) => {
    const id = c.req.param("id")
    const block = await getRoomBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Room block not found" }, 404)
    const summary = await summarizeRoomBlock(c.get("db"), id)
    return c.json({ data: { block, summary } })
  })
  .put("/room-blocks/:id/nights", async (c) => {
    const id = c.req.param("id")
    const block = await getRoomBlock(c.get("db"), id)
    if (!block) return c.json({ error: "Room block not found" }, 404)
    const { nights } = await parseJsonBody(c, setRoomBlockNightsSchema)
    await setRoomBlockNights(c.get("db"), id, nights)
    return c.json({ data: await summarizeRoomBlock(c.get("db"), id) })
  })
  .post("/room-blocks/:id/pickups", async (c) => {
    const body = await parseJsonBody(c, roomBlockPickupSchema)
    const outcome = await pickupRoomBlock(c.get("db"), { blockId: c.req.param("id"), ...body })
    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.pickup }, outcome.idempotent ? 200 : 201)
      case "block_not_found":
        return c.json({ error: "Room block not found" }, 404)
      case "invalid_range":
        return c.json({ error: "Invalid check-in/check-out range" }, 400)
      case "block_not_active":
        return c.json({ error: "Room block is no longer accepting pickups" }, 409)
      case "night_unavailable":
        return c.json(
          {
            error: "Insufficient inventory",
            detail: { date: outcome.date, remaining: outcome.remaining, needed: outcome.needed },
          },
          409,
        )
    }
  })
  .post("/room-blocks/:id/pickups/reverse", async (c) => {
    const body = await parseJsonBody(c, reverseRoomBlockPickupSchema)
    const outcome = await reverseRoomBlockPickup(c.get("db"), body)
    if (outcome.status === "pickup_not_found") {
      return c.json({ error: "Active pickup not found" }, 404)
    }
    return c.json({ data: outcome.pickup })
  })
  .post("/room-blocks/:id/release", async (c) => {
    const outcome = await releaseRoomBlockAtCutoff(c.get("db"), { blockId: c.req.param("id") })
    if (outcome.status === "block_not_found") {
      return c.json({ error: "Room block not found" }, 404)
    }
    return c.json({ data: { releasedRooms: outcome.releasedRooms, block: outcome.block } })
  })

export type RoomBlockAdminRoutes = typeof roomBlockAdminRoutes
