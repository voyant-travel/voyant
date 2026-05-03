/**
 * Hono routes for the workflow-runs admin surface.
 *
 *   GET /v1/admin/workflow-runs          → list (filter by workflow / status / tag)
 *   GET /v1/admin/workflow-runs/:id      → run + ordered steps
 *
 * Templates mount via `mountWorkflowRunsAdminRoutes(hono)` — the
 * routes are attached directly to the supplied Hono instance so they
 * inherit the parent's middleware (auth + db) without `.route()`'s
 * sub-router boundary subtleties. Read-only — runs are written by
 * the recorder, not by the API.
 */

import type { Hono } from "hono"
import { z } from "zod"

import { workflowRunsService } from "./service.js"

const listQuerySchema = z.object({
  workflowName: z.string().min(1).optional(),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]).optional(),
  tag: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export function mountWorkflowRunsAdminRoutes(hono: Hono): void {
  hono.get("/v1/admin/workflow-runs", async (c) => {
    const params = Object.fromEntries(new URL(c.req.url).searchParams)
    const parsed = listQuerySchema.safeParse(params)
    if (!parsed.success) {
      return c.json({ error: "invalid_query", detail: parsed.error.issues }, 400)
    }
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
    const db = (c.var as any).db
    if (!db) {
      console.error("[workflow-runs] c.var.db is undefined — middleware ordering issue?")
      return c.json({ error: "db_unavailable" }, 500)
    }
    try {
      const result = await workflowRunsService.listRuns(db, parsed.data)
      return c.json(result)
    } catch (err) {
      console.error("[workflow-runs] listRuns failed", err)
      return c.json(
        {
          error: "list_failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        500,
      )
    }
  })

  hono.get("/v1/admin/workflow-runs/:id", async (c) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    try {
      const result = await workflowRunsService.getRunById(db, c.req.param("id"))
      if (!result) return c.json({ error: "not_found" }, 404)
      return c.json({ data: result })
    } catch (err) {
      console.error("[workflow-runs] getRunById failed", err)
      return c.json(
        {
          error: "get_failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        500,
      )
    }
  })
}
