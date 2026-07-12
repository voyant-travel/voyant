import { type OpenAPIHono, z } from "@hono/zod-openapi"

import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { createCruisesAdminRoute as createRoute } from "./routes-openapi.js"
import { dataEnvelope, errorResponseSchema } from "./routes-openapi-schemas.js"
import { cruisesSearchService } from "./service-search.js"
import { insertSearchIndexSchema } from "./validation-search.js"

const jsonContent = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
})
const noContentResponse = { description: "Deleted" } as const

const bulkUpsertBodySchema = z.object({ entries: z.array(insertSearchIndexSchema) })
const bulkUpsertResultSchema = z.object({ upserted: z.number().int() })
const rebuildResultSchema = z.object({
  localUpserted: z.number().int(),
  externalUpserted: z.number().int(),
  externalRemoved: z.number().int(),
  externalErrors: z.array(z.object({ adapter: z.string(), error: z.string() })),
})

const bulkUpsertSearchIndexRoute = createRoute({
  method: "put",
  path: "/search-index/bulk",
  request: {
    body: { required: true, content: { "application/json": { schema: bulkUpsertBodySchema } } },
  },
  responses: {
    200: jsonContent(
      "The number of upserted search-index entries",
      dataEnvelope(bulkUpsertResultSchema),
    ),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
  },
})

const deleteSearchIndexEntryRoute = createRoute({
  method: "delete",
  path: "/search-index/{crsiId}",
  request: { params: z.object({ crsiId: z.string() }) },
  responses: {
    204: noContentResponse,
    404: jsonContent("Search-index entry not found", errorResponseSchema),
  },
})

const rebuildSearchIndexRoute = createRoute({
  method: "post",
  path: "/search-index/rebuild",
  responses: {
    200: jsonContent(
      "Rebuild counts for local + external search-index entries",
      dataEnvelope(rebuildResultSchema),
    ),
  },
})

export function registerCruiseSearchIndexRoutes(app: OpenAPIHono<Env>) {
  // --- search-index management ---
  app.openapi(bulkUpsertSearchIndexRoute, async (c) => {
    const payload = c.req.valid("json")
    const result = await cruisesSearchService.bulkUpsert(c.get("db"), payload.entries as never)
    return c.json({ data: result }, 200)
  })
  app.openapi(deleteSearchIndexEntryRoute, async (c) => {
    const ok = await cruisesSearchService.removeEntry(c.get("db"), c.req.valid("param").crsiId)
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })
  app.openapi(rebuildSearchIndexRoute, async (c) => {
    const result = await cruisesSearchService.rebuildAll(c.get("db"))
    return c.json({ data: result }, 200)
  })
}
