import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { Hono } from "hono"

import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { cruisesService } from "./service.js"
import { updateEnrichmentProgramSchema } from "./validation-content.js"
import {
  insertVoyageGroupSchema,
  insertVoyageGroupScopedSegmentSchema,
  updateVoyageGroupSchema,
  updateVoyageGroupSegmentSchema,
  voyageGroupListQuerySchema,
  voyageGroupSegmentListQuerySchema,
} from "./validation-core.js"

export function registerCruiseVoyageGroupRoutes(app: Hono<Env>) {
  app
    // --- voyage groups ---
    .get("/voyage-groups", async (c) => {
      const query = parseQuery(c, voyageGroupListQuerySchema)
      const result = await cruisesService.listVoyageGroups(c.get("db"), query)
      return c.json(result)
    })
    .post("/voyage-groups", async (c) => {
      const data = await parseJsonBody(c, insertVoyageGroupSchema)
      const row = await cruisesService.createVoyageGroup(c.get("db"), data)
      return c.json({ data: row }, 201)
    })
    .get("/voyage-groups/:id", async (c) => {
      const includes = new Set(
        (c.req.query("include") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      const row = await cruisesService.getVoyageGroupById(c.get("db"), c.req.param("id"), {
        withSegments: includes.has("segments"),
      })
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .put("/voyage-groups/:id", async (c) => {
      const data = await parseJsonBody(c, updateVoyageGroupSchema)
      const row = await cruisesService.updateVoyageGroup(c.get("db"), c.req.param("id"), data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .delete("/voyage-groups/:id", async (c) => {
      const row = await cruisesService.archiveVoyageGroup(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/voyage-groups/:id/segments", async (c) => {
      const query = parseQuery(c, voyageGroupSegmentListQuerySchema)
      const result = await cruisesService.listVoyageGroupSegments(c.get("db"), {
        ...query,
        voyageGroupId: c.req.param("id"),
      })
      return c.json(result)
    })
    .post("/voyage-groups/:id/segments", async (c) => {
      const data = await parseJsonBody(c, insertVoyageGroupScopedSegmentSchema)
      const row = await cruisesService.createVoyageGroupSegment(c.get("db"), {
        ...data,
        voyageGroupId: c.req.param("id"),
      })
      return c.json({ data: row }, 201)
    })
    .put("/voyage-group-segments/:segmentId", async (c) => {
      const data = await parseJsonBody(c, updateVoyageGroupSegmentSchema)
      const row = await cruisesService.updateVoyageGroupSegment(
        c.get("db"),
        c.req.param("segmentId"),
        data,
      )
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .delete("/voyage-group-segments/:segmentId", async (c) => {
      const ok = await cruisesService.deleteVoyageGroupSegment(
        c.get("db"),
        c.req.param("segmentId"),
      )
      if (!ok) return c.json({ error: "not_found" }, 404)
      return c.body(null, 204)
    })
    .put("/enrichment/:programId", async (c) => {
      const data = await parseJsonBody(c, updateEnrichmentProgramSchema)
      const row = await cruisesService.updateEnrichmentProgram(
        c.get("db"),
        c.req.param("programId"),
        data,
      )
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .delete("/enrichment/:programId", async (c) => {
      const ok = await cruisesService.deleteEnrichmentProgram(c.get("db"), c.req.param("programId"))
      if (!ok) return c.json({ error: "not_found" }, 404)
      return c.body(null, 204)
    })
}
