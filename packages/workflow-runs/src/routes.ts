/**
 * Hono routes for the workflow-runs admin surface.
 *
 *   GET /v1/admin/workflow-runs          → list (filter by workflow / status / tag)
 *   GET /v1/admin/workflow-runs/:id      → run + ordered steps
 *
 * Templates mount these via `additionalRoutes` or include them as
 * part of a HonoModule. Read-only — runs are written by the
 * recorder, not by the API.
 */

import { Hono } from "hono"
import { z } from "zod"

import { workflowRunsService } from "./service.js"

const listQuerySchema = z.object({
  workflowName: z.string().min(1).optional(),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]).optional(),
  tag: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export function createWorkflowRunsAdminRoutes() {
  return new Hono()
    .get("/v1/admin/workflow-runs", async (c) => {
      const params = Object.fromEntries(new URL(c.req.url).searchParams)
      const parsed = listQuerySchema.safeParse(params)
      if (!parsed.success) {
        return c.json({ error: "invalid_query", detail: parsed.error.issues }, 400)
      }
      // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
      const db = (c.var as any).db
      const result = await workflowRunsService.listRuns(db, parsed.data)
      return c.json(result)
    })
    .get("/v1/admin/workflow-runs/:id", async (c) => {
      // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
      const db = (c.var as any).db
      const result = await workflowRunsService.getRunById(db, c.req.param("id"))
      if (!result) return c.json({ error: "not_found" }, 404)
      return c.json({ data: result })
    })
}
