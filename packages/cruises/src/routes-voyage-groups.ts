import { type OpenAPIHono, z } from "@hono/zod-openapi"
import { listResponseSchema } from "@voyant-travel/types"

import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { createCruisesAdminRoute as createRoute } from "./routes-openapi.js"
import {
  cruiseVoyageGroupRowSchema,
  cruiseVoyageGroupSegmentRowSchema,
  dataEnvelope,
  enrichmentProgramRowSchema,
  errorResponseSchema,
} from "./routes-openapi-schemas.js"
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

const idParamSchema = z.object({ id: z.string() })
const segmentIdParamSchema = z.object({ segmentId: z.string() })
const programIdParamSchema = z.object({ programId: z.string() })
const jsonContent = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
})
const noContentResponse = { description: "Deleted" } as const

/** A voyage group, optionally hydrated with its ordered segments. */
const voyageGroupWithSegmentsSchema = cruiseVoyageGroupRowSchema.extend({
  segments: z.array(cruiseVoyageGroupSegmentRowSchema).optional(),
})

// --- voyage groups --------------------------------------------------------

const listVoyageGroupsRoute = createRoute({
  method: "get",
  path: "/voyage-groups",
  request: { query: voyageGroupListQuerySchema },
  responses: {
    200: jsonContent(
      "Paginated list of voyage groups",
      listResponseSchema(cruiseVoyageGroupRowSchema),
    ),
  },
})

const createVoyageGroupRoute = createRoute({
  method: "post",
  path: "/voyage-groups",
  request: {
    body: { required: true, content: { "application/json": { schema: insertVoyageGroupSchema } } },
  },
  responses: {
    201: jsonContent("The created voyage group", dataEnvelope(cruiseVoyageGroupRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
  },
})

const getVoyageGroupRoute = createRoute({
  method: "get",
  path: "/voyage-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: jsonContent(
      "A voyage group (optionally with segments)",
      dataEnvelope(voyageGroupWithSegmentsSchema),
    ),
    404: jsonContent("Voyage group not found", errorResponseSchema),
  },
})

const updateVoyageGroupRoute = createRoute({
  method: "put",
  path: "/voyage-groups/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateVoyageGroupSchema } } },
  },
  responses: {
    200: jsonContent("The updated voyage group", dataEnvelope(cruiseVoyageGroupRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
    404: jsonContent("Voyage group not found", errorResponseSchema),
  },
})

const deleteVoyageGroupRoute = createRoute({
  method: "delete",
  path: "/voyage-groups/{id}",
  request: { params: idParamSchema },
  responses: {
    200: jsonContent("The archived voyage group", dataEnvelope(cruiseVoyageGroupRowSchema)),
    404: jsonContent("Voyage group not found", errorResponseSchema),
  },
})

const listVoyageGroupSegmentsRoute = createRoute({
  method: "get",
  path: "/voyage-groups/{id}/segments",
  request: { params: idParamSchema, query: voyageGroupSegmentListQuerySchema },
  responses: {
    200: jsonContent(
      "Paginated list of segments for the voyage group",
      listResponseSchema(cruiseVoyageGroupSegmentRowSchema),
    ),
  },
})

const createVoyageGroupSegmentRoute = createRoute({
  method: "post",
  path: "/voyage-groups/{id}/segments",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertVoyageGroupScopedSegmentSchema } },
    },
  },
  responses: {
    201: jsonContent("The created segment", dataEnvelope(cruiseVoyageGroupSegmentRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
  },
})

const updateVoyageGroupSegmentRoute = createRoute({
  method: "put",
  path: "/voyage-group-segments/{segmentId}",
  request: {
    params: segmentIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateVoyageGroupSegmentSchema } },
    },
  },
  responses: {
    200: jsonContent("The updated segment", dataEnvelope(cruiseVoyageGroupSegmentRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
    404: jsonContent("Segment not found", errorResponseSchema),
  },
})

const deleteVoyageGroupSegmentRoute = createRoute({
  method: "delete",
  path: "/voyage-group-segments/{segmentId}",
  request: { params: segmentIdParamSchema },
  responses: {
    204: noContentResponse,
    404: jsonContent("Segment not found", errorResponseSchema),
  },
})

const updateEnrichmentProgramRoute = createRoute({
  method: "put",
  path: "/enrichment/{programId}",
  request: {
    params: programIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateEnrichmentProgramSchema } },
    },
  },
  responses: {
    200: jsonContent("The updated enrichment program", dataEnvelope(enrichmentProgramRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
    404: jsonContent("Enrichment program not found", errorResponseSchema),
  },
})

const deleteEnrichmentProgramRoute = createRoute({
  method: "delete",
  path: "/enrichment/{programId}",
  request: { params: programIdParamSchema },
  responses: {
    204: noContentResponse,
    404: jsonContent("Enrichment program not found", errorResponseSchema),
  },
})

export function registerCruiseVoyageGroupRoutes(app: OpenAPIHono<Env>) {
  // --- voyage groups ---
  app.openapi(listVoyageGroupsRoute, async (c) => {
    const result = await cruisesService.listVoyageGroups(c.get("db"), c.req.valid("query"))
    return c.json(result, 200)
  })
  app.openapi(createVoyageGroupRoute, async (c) => {
    const row = await cruisesService.createVoyageGroup(c.get("db"), c.req.valid("json"))
    return c.json({ data: row }, 201)
  })
  app.openapi(getVoyageGroupRoute, async (c) => {
    const includes = new Set(
      (c.req.query("include") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const row = await cruisesService.getVoyageGroupById(c.get("db"), c.req.valid("param").id, {
      withSegments: includes.has("segments"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(updateVoyageGroupRoute, async (c) => {
    const row = await cruisesService.updateVoyageGroup(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(deleteVoyageGroupRoute, async (c) => {
    const row = await cruisesService.archiveVoyageGroup(c.get("db"), c.req.valid("param").id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(listVoyageGroupSegmentsRoute, async (c) => {
    const result = await cruisesService.listVoyageGroupSegments(c.get("db"), {
      ...c.req.valid("query"),
      voyageGroupId: c.req.valid("param").id,
    })
    return c.json(result, 200)
  })
  app.openapi(createVoyageGroupSegmentRoute, async (c) => {
    const row = await cruisesService.createVoyageGroupSegment(c.get("db"), {
      ...c.req.valid("json"),
      voyageGroupId: c.req.valid("param").id,
    })
    return c.json({ data: row }, 201)
  })
  app.openapi(updateVoyageGroupSegmentRoute, async (c) => {
    const row = await cruisesService.updateVoyageGroupSegment(
      c.get("db"),
      c.req.valid("param").segmentId,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(deleteVoyageGroupSegmentRoute, async (c) => {
    const ok = await cruisesService.deleteVoyageGroupSegment(
      c.get("db"),
      c.req.valid("param").segmentId,
    )
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })
  // --- enrichment program direct mutations (by program id) ---
  app.openapi(updateEnrichmentProgramRoute, async (c) => {
    const row = await cruisesService.updateEnrichmentProgram(
      c.get("db"),
      c.req.valid("param").programId,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(deleteEnrichmentProgramRoute, async (c) => {
    const ok = await cruisesService.deleteEnrichmentProgram(
      c.get("db"),
      c.req.valid("param").programId,
    )
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })
}
