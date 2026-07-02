/**
 * Relationships "activities" admin routes — CRM activities plus their entity
 * links and participants. Migrated to `@hono/zod-openapi` for the OpenAPI admin
 * backfill (voyant#2276 — step 3.5, stage B). Request schemas reuse the
 * exported `validation.ts` insert/update/list-query schemas the handlers already
 * parsed; response row schemas live in `rest-openapi-schemas.ts` (authored from
 * the Drizzle `$inferSelect` shapes; §17 timestamps → strings). Business logic
 * and wire envelopes are unchanged — handlers read `c.req.valid(...)` and still
 * call the same `relationshipsService` methods via `c.get("db")`. Each route is
 * registered statement-style (`app.openapi(route, handler)`) to keep
 * type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { relationshipsService } from "../service/index.js"
import {
  activityListQuerySchema,
  insertActivityLinkSchema,
  insertActivityParticipantSchema,
  insertActivitySchema,
  updateActivitySchema,
} from "../validation.js"
import {
  activityLinkSchema,
  activityParticipantSchema,
  activitySchema,
  errorResponseSchema,
  idParamSchema,
  successResponseSchema,
} from "./rest-openapi-schemas.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

const listActivitiesRoute = createRoute({
  method: "get",
  path: "/activities",
  request: { query: activityListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of activities",
      ...jsonContent(listResponseSchema(activitySchema)),
    },
  },
})

const createActivityRoute = createRoute({
  method: "post",
  path: "/activities",
  request: requiredJsonBody(insertActivitySchema),
  responses: {
    201: {
      description: "The created activity",
      ...jsonContent(z.object({ data: activitySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getActivityRoute = createRoute({
  method: "get",
  path: "/activities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "An activity by id", ...jsonContent(z.object({ data: activitySchema })) },
    404: { description: "Activity not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateActivityRoute = createRoute({
  method: "patch",
  path: "/activities/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateActivitySchema) },
  responses: {
    200: {
      description: "The updated activity",
      ...jsonContent(z.object({ data: activitySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Activity not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteActivityRoute = createRoute({
  method: "delete",
  path: "/activities/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Activity deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Activity not found", ...jsonContent(errorResponseSchema) },
  },
})

const listActivityLinksRoute = createRoute({
  method: "get",
  path: "/activities/{id}/links",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Entity links for the activity",
      ...jsonContent(z.object({ data: z.array(activityLinkSchema) })),
    },
  },
})

const createActivityLinkRoute = createRoute({
  method: "post",
  path: "/activities/{id}/links",
  request: { params: idParamSchema, ...requiredJsonBody(insertActivityLinkSchema) },
  responses: {
    201: {
      description: "The created activity link",
      ...jsonContent(z.object({ data: activityLinkSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Linked entity not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteActivityLinkRoute = createRoute({
  method: "delete",
  path: "/activity-links/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Activity link deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Activity link not found", ...jsonContent(errorResponseSchema) },
  },
})

const listActivityParticipantsRoute = createRoute({
  method: "get",
  path: "/activities/{id}/participants",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Participants for the activity",
      ...jsonContent(z.object({ data: z.array(activityParticipantSchema) })),
    },
  },
})

const createActivityParticipantRoute = createRoute({
  method: "post",
  path: "/activities/{id}/participants",
  request: { params: idParamSchema, ...requiredJsonBody(insertActivityParticipantSchema) },
  responses: {
    201: {
      description: "The created activity participant",
      ...jsonContent(z.object({ data: activityParticipantSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const deleteActivityParticipantRoute = createRoute({
  method: "delete",
  path: "/activity-participants/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Activity participant deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Activity participant not found", ...jsonContent(errorResponseSchema) },
  },
})

export const activityRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

activityRoutes.openapi(listActivitiesRoute, async (c) =>
  c.json(await relationshipsService.listActivities(c.get("db"), c.req.valid("query")), 200),
)
activityRoutes.openapi(createActivityRoute, async (c) => {
  const row = await relationshipsService.createActivity(c.get("db"), c.req.valid("json"))
  return c.json({ data: row! }, 201)
})
activityRoutes.openapi(getActivityRoute, async (c) => {
  const row = await relationshipsService.getActivityById(c.get("db"), c.req.valid("param").id)
  return row ? c.json({ data: row }, 200) : c.json({ error: "Activity not found" }, 404)
})
activityRoutes.openapi(updateActivityRoute, async (c) => {
  const row = await relationshipsService.updateActivity(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Activity not found" }, 404)
})
activityRoutes.openapi(deleteActivityRoute, async (c) => {
  const row = await relationshipsService.deleteActivity(c.get("db"), c.req.valid("param").id)
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Activity not found" }, 404)
})
activityRoutes.openapi(listActivityLinksRoute, async (c) =>
  c.json(
    { data: await relationshipsService.listActivityLinks(c.get("db"), c.req.valid("param").id) },
    200,
  ),
)
activityRoutes.openapi(createActivityLinkRoute, async (c) => {
  const row = await relationshipsService.createActivityLink(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 201) : c.json({ error: "Linked entity not found" }, 404)
})
activityRoutes.openapi(deleteActivityLinkRoute, async (c) => {
  const row = await relationshipsService.deleteActivityLink(c.get("db"), c.req.valid("param").id)
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Activity link not found" }, 404)
})
activityRoutes.openapi(listActivityParticipantsRoute, async (c) =>
  c.json(
    {
      data: await relationshipsService.listActivityParticipants(
        c.get("db"),
        c.req.valid("param").id,
      ),
    },
    200,
  ),
)
activityRoutes.openapi(createActivityParticipantRoute, async (c) => {
  const row = await relationshipsService.createActivityParticipant(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return c.json({ data: row! }, 201)
})
activityRoutes.openapi(deleteActivityParticipantRoute, async (c) => {
  const row = await relationshipsService.deleteActivityParticipant(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Activity participant not found" }, 404)
})
