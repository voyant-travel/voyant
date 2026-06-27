/**
 * External-reference admin routes — the cross-system id mapping registry
 * (`external_refs`): list/create/get/patch/delete plus the entity-scoped
 * list/create legs. Migrated to `@hono/zod-openapi` for the OpenAPI admin
 * backfill (voyant#2114 — distribution sub-batch) via the same NON-BREAKING
 * dual-mount: the exported `externalRefsRoutes` `OpenAPIHono` instance is
 * mounted by the framework on BOTH the legacy `/v1/external-refs/*` surface (the
 * dashboard still calls those paths) AND the documented staff surface at
 * `/v1/admin/external-refs/*` (see `external-refs/index.ts`). Request schemas
 * reuse the exported `validation.ts` schemas; the response row schema is
 * authored from the Drizzle `$inferSelect` shape (§17 timestamps → strings).
 * Handlers read `c.req.valid(...)`; the entity-scoped list still re-parses the
 * merged params via the full list-query schema.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { externalRefsService } from "./service.js"
import {
  externalRefListQuerySchema,
  externalRefStatusSchema,
  insertExternalRefForEntitySchema,
  insertExternalRefSchema,
  updateExternalRefSchema,
} from "./validation.js"

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

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idParamSchema = z.object({ id: z.string() })
const entityParamSchema = z.object({ entityType: z.string(), entityId: z.string() })

// §17: `timestamp` columns are serialized to ISO strings over the wire.
const externalRefSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  sourceSystem: z.string(),
  objectType: z.string(),
  namespace: z.string(),
  externalId: z.string(),
  externalParentId: z.string().nullable(),
  isPrimary: z.boolean(),
  status: externalRefStatusSchema,
  lastSyncedAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const listExternalRefsRoute = createRoute({
  method: "get",
  path: "/refs",
  request: { query: externalRefListQuerySchema },
  responses: {
    200: {
      description: "Paginated external references",
      ...jsonContent(listResponseSchema(externalRefSchema)),
    },
  },
})

const createExternalRefRoute = createRoute({
  method: "post",
  path: "/refs",
  request: requiredJsonBody(insertExternalRefSchema),
  responses: {
    201: {
      description: "The created external reference",
      ...jsonContent(z.object({ data: externalRefSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getExternalRefRoute = createRoute({
  method: "get",
  path: "/refs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An external reference by id",
      ...jsonContent(z.object({ data: externalRefSchema })),
    },
    404: { description: "External reference not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateExternalRefRoute = createRoute({
  method: "patch",
  path: "/refs/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateExternalRefSchema) },
  responses: {
    200: {
      description: "The updated external reference",
      ...jsonContent(z.object({ data: externalRefSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "External reference not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteExternalRefRoute = createRoute({
  method: "delete",
  path: "/refs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "External reference deleted", ...jsonContent(successResponseSchema) },
    404: { description: "External reference not found", ...jsonContent(errorResponseSchema) },
  },
})

const listEntityExternalRefsRoute = createRoute({
  method: "get",
  path: "/entities/{entityType}/{entityId}/refs",
  request: {
    params: entityParamSchema,
    query: externalRefListQuerySchema.partial(),
  },
  responses: {
    200: {
      description: "Paginated external references for an entity",
      ...jsonContent(listResponseSchema(externalRefSchema)),
    },
  },
})

const createEntityExternalRefRoute = createRoute({
  method: "post",
  path: "/entities/{entityType}/{entityId}/refs",
  request: {
    params: entityParamSchema,
    ...requiredJsonBody(insertExternalRefForEntitySchema),
  },
  responses: {
    201: {
      description: "The created external reference for an entity",
      ...jsonContent(z.object({ data: externalRefSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

export const externalRefsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listExternalRefsRoute, async (c) =>
    c.json(await externalRefsService.listExternalRefs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createExternalRefRoute, async (c) => {
    const row = await externalRefsService.createExternalRef(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getExternalRefRoute, async (c) => {
    const row = await externalRefsService.getExternalRefById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "External reference not found" }, 404)
  })
  .openapi(updateExternalRefRoute, async (c) => {
    const row = await externalRefsService.updateExternalRef(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "External reference not found" }, 404)
  })
  .openapi(deleteExternalRefRoute, async (c) => {
    const row = await externalRefsService.deleteExternalRef(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "External reference not found" }, 404)
  })
  .openapi(listEntityExternalRefsRoute, async (c) => {
    const params = c.req.valid("param")
    const query = externalRefListQuerySchema.parse({
      ...c.req.valid("query"),
      entityType: params.entityType,
      entityId: params.entityId,
    })
    return c.json(await externalRefsService.listExternalRefs(c.get("db"), query), 200)
  })
  .openapi(createEntityExternalRefRoute, async (c) => {
    const params = c.req.valid("param")
    const body = c.req.valid("json")
    const row = await externalRefsService.createExternalRef(c.get("db"), {
      ...body,
      entityType: params.entityType,
      entityId: params.entityId,
    })
    return c.json({ data: row! }, 201)
  })

export type ExternalRefsRoutes = typeof externalRefsRoutes
