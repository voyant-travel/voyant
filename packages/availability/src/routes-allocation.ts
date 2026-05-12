import { parseJsonBody } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import type { Env } from "./routes-shared.js"
import {
  AllocationServiceError,
  assignTravelerAllocation,
  createAllocationResource,
  deleteAllocationResource,
  getSlotAllocationManifest,
  pairSharingGroup,
  updateAllocationResource,
  updateTravelerSharingGroup,
} from "./service-allocation.js"
import {
  assignTravelerAllocationSchema,
  insertAllocationResourceSchema,
  pairSharingGroupSchema,
  updateAllocationResourceSchema,
  updateTravelerSharingGroupSchema,
} from "./validation.js"

export const availabilityAllocationRoutes = new Hono<Env>()
  .get("/slots/:id/allocation", async (c) => {
    const manifest = await getSlotAllocationManifest(c.get("db"), c.req.param("id"))
    return manifest
      ? c.json({ data: manifest })
      : c.json({ error: "Availability slot not found" }, 404)
  })
  .post("/slots/:id/allocation/resources", async (c) => {
    const row = await createAllocationResource(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertAllocationResourceSchema),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Availability slot not found" }, 404)
  })
  .patch("/slots/:id/allocation/resources/:resourceId", async (c) => {
    try {
      const row = await updateAllocationResource(
        c.get("db"),
        c.req.param("id"),
        c.req.param("resourceId"),
        await parseJsonBody(c, updateAllocationResourceSchema),
      )
      return row ? c.json({ data: row }) : c.json({ error: "Allocation resource not found" }, 404)
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .delete("/slots/:id/allocation/resources/:resourceId", async (c) => {
    const row = await deleteAllocationResource(
      c.get("db"),
      c.req.param("id"),
      c.req.param("resourceId"),
    )
    return row ? c.json({ data: row }) : c.json({ error: "Allocation resource not found" }, 404)
  })
  .patch("/slots/:id/allocation/travelers/:travelerId", async (c) => {
    try {
      const result = await assignTravelerAllocation(
        c.get("db"),
        c.req.param("id"),
        c.req.param("travelerId"),
        await parseJsonBody(c, assignTravelerAllocationSchema),
      )
      return c.json({ data: result })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .patch("/slots/:id/allocation/travelers/:travelerId/sharing-group", async (c) => {
    try {
      const result = await updateTravelerSharingGroup(
        c.get("db"),
        c.req.param("id"),
        c.req.param("travelerId"),
        await parseJsonBody(c, updateTravelerSharingGroupSchema),
      )
      return c.json({ data: result })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .post("/slots/:id/allocation/sharing-groups/pair", async (c) => {
    try {
      const result = await pairSharingGroup(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, pairSharingGroupSchema),
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })

function handleAllocationRouteError(c: Context<Env>, error: unknown): Response {
  if (error instanceof AllocationServiceError) {
    return c.json(
      {
        error: error.message,
        ...(error.detail ? { detail: error.detail } : {}),
      },
      error.status as 400 | 404 | 409,
    )
  }
  throw error
}
