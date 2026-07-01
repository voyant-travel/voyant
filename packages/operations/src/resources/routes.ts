/**
 * Operations "resources" admin routes — the operated-resource registry plus its
 * pooling, requirement/allocation, slot-assignment, and closeout surfaces. The
 * router is mounted on the legacy `/v1/operations/*` surface (operator React
 * clients hit those paths) AND, for the published OpenAPI admin contract, on the
 * staff surface at `/v1/admin/operations/*` (see `operations/routes.ts`).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * the final operations sub-batch). Request schemas reuse the exported
 * `validation.ts` insert/update/list-query schemas the handlers already parse;
 * response row schemas are authored here from the Drizzle `$inferSelect` shapes
 * (§17 dates/timestamps → strings). The list services do plain
 * `db.select().from(...)` with no joins, so list rows equal the single-entity
 * rows (no `.extend({...})` needed). Each resource is its own small
 * `OpenAPIHono` sub-chain composed onto `resourcesRoutes` via `.route("/")` so
 * the `.openapi()` operations propagate up through the parent registries while
 * keeping type-inference cost bounded (one flat chain has O(n²) inference cost).
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD + batch bundle over seven resource surfaces (45 legs), each with a
 * `createRoute` def + co-located handler per the established admin route pattern
 * (mirrors availability's `routes-core.ts`). Splitting per resource would
 * fragment the single mounted instance without aiding review. See voyant#2114.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { ResourcesServiceError, resourcesService } from "./service.js"
import {
  insertResourceCloseoutSchema,
  insertResourcePoolMemberSchema,
  insertResourcePoolSchema,
  insertResourceRequirementSchema,
  insertResourceSchema,
  insertResourceSlotAssignmentSchema,
  resourceAllocationModeSchema,
  resourceAssignmentStatusSchema,
  resourceCloseoutListQuerySchema,
  resourceKindSchema,
  resourceListQuerySchema,
  resourcePoolListQuerySchema,
  resourcePoolMemberListQuerySchema,
  resourceRequirementListQuerySchema,
  resourceSlotAssignmentListQuerySchema,
  updateResourceCloseoutSchema,
  updateResourcePoolSchema,
  updateResourceRequirementSchema,
  updateResourceSchema,
  updateResourceSlotAssignmentSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const batchIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
})

const createBatchUpdateSchema = <TPatch extends z.ZodTypeAny>(patchSchema: TPatch) =>
  z.object({
    ids: batchIdsSchema.shape.ids,
    patch: patchSchema.refine((value) => Object.keys(value as Record<string, unknown>).length > 0, {
      message: "Patch payload is required",
    }),
  })

const batchUpdateResourceSchema = createBatchUpdateSchema(updateResourceSchema)
const batchUpdateResourcePoolSchema = createBatchUpdateSchema(updateResourcePoolSchema)
const batchUpdateResourceRequirementSchema = createBatchUpdateSchema(
  updateResourceRequirementSchema,
)
const batchUpdateResourceSlotAssignmentSchema = createBatchUpdateSchema(
  updateResourceSlotAssignmentSchema,
)
const batchUpdateResourceCloseoutSchema = createBatchUpdateSchema(updateResourceCloseoutSchema)

async function handleBatchUpdate<TPatch, TRow>({
  db,
  ids,
  patch,
  update,
}: {
  db: PostgresJsDatabase
  ids: string[]
  patch: TPatch
  update: (db: PostgresJsDatabase, id: string, patch: TPatch) => Promise<TRow | null>
}) {
  const results: Array<{ id: string; row: TRow | null; error?: string }> = []
  for (const id of ids) {
    try {
      const row = await update(db, id, patch)
      results.push({ id, row })
    } catch (error) {
      if (error instanceof ResourcesServiceError) {
        results.push({ id, row: null, error: error.message })
        continue
      }
      throw error
    }
  }

  const data = results.flatMap((result) => (result.row ? [result.row] : []))
  const failed = results
    .filter((result) => result.row === null)
    .map((result) => ({ id: result.id, error: result.error ?? "Not found" }))

  return {
    data,
    total: ids.length,
    succeeded: data.length,
    failed,
  }
}

async function handleBatchDelete({
  db,
  ids,
  remove,
}: {
  db: PostgresJsDatabase
  ids: string[]
  remove: (db: PostgresJsDatabase, id: string) => Promise<{ id: string } | null>
}) {
  const results: Array<{ id: string } | { id: string; error: string }> = []
  for (const id of ids) {
    const row = await remove(db, id)
    results.push(row ? { id } : { id, error: "Not found" })
  }

  const deletedIds = results.flatMap((result) => ("error" in result ? [] : [result.id]))
  const failed = results
    .filter((result): result is { id: string; error: string } => "error" in result)
    .map((result) => ({ id: result.id, error: result.error }))

  return {
    deletedIds,
    total: ids.length,
    succeeded: deletedIds.length,
    failed,
  }
}

// --- shared response schemas ------------------------------------------------

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.literal(true) })
const idSchema = z.string()
const idParamSchema = z.object({ id: idSchema })

function handleResourcesRouteError(c: Context<Env>, error: unknown) {
  if (error instanceof ResourcesServiceError) {
    return c.json({ error: error.message }, error.status)
  }
  throw error
}

function handleResourcesNotFoundRouteError(c: Context<Env>, error: unknown) {
  if (error instanceof ResourcesServiceError && error.status === 404) {
    return c.json({ error: error.message }, 404)
  }
  throw error
}

function handleSlotAssignmentRouteError(c: Context<Env>, error: unknown) {
  if (error instanceof ResourcesServiceError) {
    if (error.status === 400) return c.json({ error: error.message }, 400)
    if (error.status === 404) return c.json({ error: error.message }, 404)
  }
  throw error
}

/** Envelope returned by the shared batch-update handler. */
function batchUpdateResponseSchema<T extends z.ZodTypeAny>(row: T) {
  return z.object({
    data: z.array(row),
    total: z.number().int(),
    succeeded: z.number().int(),
    failed: z.array(z.object({ id: idSchema, error: z.string() })),
  })
}

/** Envelope returned by the shared batch-delete handler. */
const batchDeleteResponseSchema = z.object({
  deletedIds: z.array(idSchema),
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.array(z.object({ id: idSchema, error: z.string() })),
})

// §17: timestamps/dates are serialized to ISO strings on the wire.
const resourceSchema = z.object({
  id: idSchema,
  supplierId: z.string().nullable(),
  facilityId: z.string().nullable(),
  kind: resourceKindSchema,
  name: z.string(),
  code: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const resourcePoolSchema = z.object({
  id: idSchema,
  productId: z.string().nullable(),
  kind: resourceKindSchema,
  name: z.string(),
  sharedCapacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const resourcePoolMemberSchema = z.object({
  id: idSchema,
  poolId: z.string(),
  resourceId: z.string(),
  createdAt: z.string(),
})

const resourceRequirementSchema = z.object({
  id: idSchema,
  poolId: z.string(),
  productId: z.string(),
  availabilityRuleId: z.string().nullable(),
  startTimeId: z.string().nullable(),
  quantityRequired: z.number().int(),
  allocationMode: resourceAllocationModeSchema,
  priority: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const resourceSlotAssignmentSchema = z.object({
  id: idSchema,
  slotId: z.string(),
  poolId: z.string().nullable(),
  resourceId: z.string().nullable(),
  bookingId: z.string().nullable(),
  status: resourceAssignmentStatusSchema,
  assignedAt: z.string(),
  assignedBy: z.string().nullable(),
  releasedAt: z.string().nullable(),
  notes: z.string().nullable(),
})

const resourceCloseoutSchema = z.object({
  id: idSchema,
  resourceId: z.string(),
  dateLocal: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  reason: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
})

// --- resources --------------------------------------------------------------

const listResourcesRoute = createRoute({
  method: "get",
  path: "/resources",
  request: { query: resourceListQuerySchema },
  responses: {
    200: {
      description: "Paginated operated resources",
      content: { "application/json": { schema: listResponseSchema(resourceSchema) } },
    },
  },
})

const createResourceRoute = createRoute({
  method: "post",
  path: "/resources",
  request: {
    body: { required: true, content: { "application/json": { schema: insertResourceSchema } } },
  },
  responses: {
    201: {
      description: "The created resource",
      content: { "application/json": { schema: z.object({ data: resourceSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdateResourcesRoute = createRoute({
  method: "post",
  path: "/resources/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourceSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchUpdateResponseSchema(resourceSchema) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeleteResourcesRoute = createRoute({
  method: "post",
  path: "/resources/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getResourceRoute = createRoute({
  method: "get",
  path: "/resources/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource by id",
      content: { "application/json": { schema: z.object({ data: resourceSchema }) } },
    },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateResourceRoute = createRoute({
  method: "patch",
  path: "/resources/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateResourceSchema } } },
  },
  responses: {
    200: {
      description: "The updated resource",
      content: { "application/json": { schema: z.object({ data: resourceSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteResourceRoute = createRoute({
  method: "delete",
  path: "/resources/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const resourceRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listResourcesRoute, async (c) =>
    c.json(await resourcesService.listResources(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createResourceRoute, async (c) => {
    const row = await resourcesService.createResource(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateResourcesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateResource,
      }),
      200,
    )
  })
  .openapi(batchDeleteResourcesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteResource,
      }),
      200,
    )
  })
  .openapi(getResourceRoute, async (c) => {
    const row = await resourcesService.getResourceById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Resource not found" }, 404)
  })
  .openapi(updateResourceRoute, async (c) => {
    const row = await resourcesService.updateResource(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Resource not found" }, 404)
  })
  .openapi(deleteResourceRoute, async (c) => {
    const row = await resourcesService.deleteResource(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource not found" }, 404)
  })

// --- pools ------------------------------------------------------------------

const listPoolsRoute = createRoute({
  method: "get",
  path: "/pools",
  request: { query: resourcePoolListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource pools",
      content: { "application/json": { schema: listResponseSchema(resourcePoolSchema) } },
    },
  },
})

const createPoolRoute = createRoute({
  method: "post",
  path: "/pools",
  request: {
    body: { required: true, content: { "application/json": { schema: insertResourcePoolSchema } } },
  },
  responses: {
    201: {
      description: "The created resource pool",
      content: { "application/json": { schema: z.object({ data: resourcePoolSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdatePoolsRoute = createRoute({
  method: "post",
  path: "/pools/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourcePoolSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchUpdateResponseSchema(resourcePoolSchema) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeletePoolsRoute = createRoute({
  method: "post",
  path: "/pools/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getPoolRoute = createRoute({
  method: "get",
  path: "/pools/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource pool by id",
      content: { "application/json": { schema: z.object({ data: resourcePoolSchema }) } },
    },
    404: {
      description: "Resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePoolRoute = createRoute({
  method: "patch",
  path: "/pools/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updateResourcePoolSchema } } },
  },
  responses: {
    200: {
      description: "The updated resource pool",
      content: { "application/json": { schema: z.object({ data: resourcePoolSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePoolRoute = createRoute({
  method: "delete",
  path: "/pools/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource pool deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const poolRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPoolsRoute, async (c) =>
    c.json(await resourcesService.listPools(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPoolRoute, async (c) => {
    const row = await resourcesService.createPool(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdatePoolsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updatePool,
      }),
      200,
    )
  })
  .openapi(batchDeletePoolsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deletePool,
      }),
      200,
    )
  })
  .openapi(getPoolRoute, async (c) => {
    const row = await resourcesService.getPoolById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Resource pool not found" }, 404)
  })
  .openapi(updatePoolRoute, async (c) => {
    const row = await resourcesService.updatePool(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Resource pool not found" }, 404)
  })
  .openapi(deletePoolRoute, async (c) => {
    const row = await resourcesService.deletePool(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource pool not found" }, 404)
  })

// --- pool members -----------------------------------------------------------

const listPoolMembersRoute = createRoute({
  method: "get",
  path: "/pool-members",
  request: { query: resourcePoolMemberListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource pool members",
      content: { "application/json": { schema: listResponseSchema(resourcePoolMemberSchema) } },
    },
  },
})

const createPoolMemberRoute = createRoute({
  method: "post",
  path: "/pool-members",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertResourcePoolMemberSchema } },
    },
  },
  responses: {
    201: {
      description: "The created resource pool member",
      content: { "application/json": { schema: z.object({ data: resourcePoolMemberSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Referenced resource pool or resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Resource pool member already exists",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePoolMemberRoute = createRoute({
  method: "delete",
  path: "/pool-members/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource pool member deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource pool member not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const poolMemberRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listPoolMembersRoute, async (c) =>
    c.json(await resourcesService.listPoolMembers(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPoolMemberRoute, async (c) => {
    try {
      const row = await resourcesService.createPoolMember(c.get("db"), c.req.valid("json"))
      return c.json({ data: row! }, 201)
    } catch (error) {
      return handleResourcesRouteError(c, error)
    }
  })
  .openapi(deletePoolMemberRoute, async (c) => {
    const row = await resourcesService.deletePoolMember(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource pool member not found" }, 404)
  })

// --- requirements -----------------------------------------------------------

const listRequirementsRoute = createRoute({
  method: "get",
  path: "/requirements",
  request: { query: resourceRequirementListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource requirements",
      content: { "application/json": { schema: listResponseSchema(resourceRequirementSchema) } },
    },
  },
})

const createRequirementRoute = createRoute({
  method: "post",
  path: "/requirements",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertResourceRequirementSchema } },
    },
  },
  responses: {
    201: {
      description: "The created resource requirement",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Referenced resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdateRequirementsRoute = createRoute({
  method: "post",
  path: "/requirements/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourceRequirementSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(resourceRequirementSchema) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeleteRequirementsRoute = createRoute({
  method: "post",
  path: "/requirements/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getRequirementRoute = createRoute({
  method: "get",
  path: "/requirements/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource requirement by id",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    404: {
      description: "Resource requirement not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateRequirementRoute = createRoute({
  method: "patch",
  path: "/requirements/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateResourceRequirementSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated resource requirement",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource requirement or referenced resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteRequirementRoute = createRoute({
  method: "delete",
  path: "/requirements/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource requirement deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource requirement not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const requirementRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listRequirementsRoute, async (c) =>
    c.json(await resourcesService.listRequirements(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createRequirementRoute, async (c) => {
    try {
      const row = await resourcesService.createRequirement(c.get("db"), c.req.valid("json"))
      return c.json({ data: row! }, 201)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(batchUpdateRequirementsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateRequirement,
      }),
      200,
    )
  })
  .openapi(batchDeleteRequirementsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteRequirement,
      }),
      200,
    )
  })
  .openapi(getRequirementRoute, async (c) => {
    const row = await resourcesService.getRequirementById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Resource requirement not found" }, 404)
  })
  .openapi(updateRequirementRoute, async (c) => {
    try {
      const row = await resourcesService.updateRequirement(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Resource requirement not found" }, 404)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(deleteRequirementRoute, async (c) => {
    const row = await resourcesService.deleteRequirement(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource requirement not found" }, 404)
  })

// --- allocations ------------------------------------------------------------
// Allocations are an alias surface over requirements (same `resourceRequirements`
// table/service) with allocation-flavoured 404 messages — see `service.ts`.

const listAllocationsRoute = createRoute({
  method: "get",
  path: "/allocations",
  request: { query: resourceRequirementListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource allocations",
      content: { "application/json": { schema: listResponseSchema(resourceRequirementSchema) } },
    },
  },
})

const createAllocationRoute = createRoute({
  method: "post",
  path: "/allocations",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertResourceRequirementSchema } },
    },
  },
  responses: {
    201: {
      description: "The created resource allocation",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Referenced resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdateAllocationsRoute = createRoute({
  method: "post",
  path: "/allocations/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourceRequirementSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(resourceRequirementSchema) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeleteAllocationsRoute = createRoute({
  method: "post",
  path: "/allocations/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getAllocationRoute = createRoute({
  method: "get",
  path: "/allocations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource allocation by id",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    404: {
      description: "Resource allocation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateAllocationRoute = createRoute({
  method: "patch",
  path: "/allocations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateResourceRequirementSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated resource allocation",
      content: { "application/json": { schema: z.object({ data: resourceRequirementSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource allocation or referenced resource pool not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteAllocationRoute = createRoute({
  method: "delete",
  path: "/allocations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource allocation deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource allocation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const allocationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listAllocationsRoute, async (c) =>
    c.json(await resourcesService.listRequirements(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createAllocationRoute, async (c) => {
    try {
      const row = await resourcesService.createRequirement(c.get("db"), c.req.valid("json"))
      return c.json({ data: row! }, 201)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(batchUpdateAllocationsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateRequirement,
      }),
      200,
    )
  })
  .openapi(batchDeleteAllocationsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteRequirement,
      }),
      200,
    )
  })
  .openapi(getAllocationRoute, async (c) => {
    const row = await resourcesService.getRequirementById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Resource allocation not found" }, 404)
  })
  .openapi(updateAllocationRoute, async (c) => {
    try {
      const row = await resourcesService.updateRequirement(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Resource allocation not found" }, 404)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(deleteAllocationRoute, async (c) => {
    const row = await resourcesService.deleteRequirement(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource allocation not found" }, 404)
  })

// --- slot assignments -------------------------------------------------------

const listSlotAssignmentsRoute = createRoute({
  method: "get",
  path: "/slot-assignments",
  request: { query: resourceSlotAssignmentListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource slot assignments",
      content: {
        "application/json": { schema: listResponseSchema(resourceSlotAssignmentSchema) },
      },
    },
  },
})

const createSlotAssignmentRoute = createRoute({
  method: "post",
  path: "/slot-assignments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertResourceSlotAssignmentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created resource slot assignment",
      content: { "application/json": { schema: z.object({ data: resourceSlotAssignmentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Referenced resource pool or resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdateSlotAssignmentsRoute = createRoute({
  method: "post",
  path: "/slot-assignments/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourceSlotAssignmentSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(resourceSlotAssignmentSchema) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeleteSlotAssignmentsRoute = createRoute({
  method: "post",
  path: "/slot-assignments/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getSlotAssignmentRoute = createRoute({
  method: "get",
  path: "/slot-assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource slot assignment by id",
      content: { "application/json": { schema: z.object({ data: resourceSlotAssignmentSchema }) } },
    },
    404: {
      description: "Resource slot assignment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateSlotAssignmentRoute = createRoute({
  method: "patch",
  path: "/slot-assignments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateResourceSlotAssignmentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated resource slot assignment",
      content: { "application/json": { schema: z.object({ data: resourceSlotAssignmentSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource slot assignment or referenced resource pool/resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteSlotAssignmentRoute = createRoute({
  method: "delete",
  path: "/slot-assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource slot assignment deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource slot assignment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const slotAssignmentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listSlotAssignmentsRoute, async (c) =>
    c.json(await resourcesService.listSlotAssignments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSlotAssignmentRoute, async (c) => {
    try {
      const row = await resourcesService.createSlotAssignment(c.get("db"), c.req.valid("json"))
      return c.json({ data: row! }, 201)
    } catch (error) {
      return handleSlotAssignmentRouteError(c, error)
    }
  })
  .openapi(batchUpdateSlotAssignmentsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateSlotAssignment,
      }),
      200,
    )
  })
  .openapi(batchDeleteSlotAssignmentsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteSlotAssignment,
      }),
      200,
    )
  })
  .openapi(getSlotAssignmentRoute, async (c) => {
    const row = await resourcesService.getSlotAssignmentById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Resource slot assignment not found" }, 404)
  })
  .openapi(updateSlotAssignmentRoute, async (c) => {
    try {
      const row = await resourcesService.updateSlotAssignment(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Resource slot assignment not found" }, 404)
    } catch (error) {
      return handleSlotAssignmentRouteError(c, error)
    }
  })
  .openapi(deleteSlotAssignmentRoute, async (c) => {
    const row = await resourcesService.deleteSlotAssignment(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource slot assignment not found" }, 404)
  })

// --- closeouts --------------------------------------------------------------

const listCloseoutsRoute = createRoute({
  method: "get",
  path: "/closeouts",
  request: { query: resourceCloseoutListQuerySchema },
  responses: {
    200: {
      description: "Paginated resource closeouts",
      content: { "application/json": { schema: listResponseSchema(resourceCloseoutSchema) } },
    },
  },
})

const createCloseoutRoute = createRoute({
  method: "post",
  path: "/closeouts",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertResourceCloseoutSchema } },
    },
  },
  responses: {
    201: {
      description: "The created resource closeout",
      content: { "application/json": { schema: z.object({ data: resourceCloseoutSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Referenced resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchUpdateCloseoutsRoute = createRoute({
  method: "post",
  path: "/closeouts/batch-update",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchUpdateResourceCloseoutSchema } },
    },
  },
  responses: {
    200: {
      description: "Per-id batch-update results (missing ids reported under `failed`)",
      content: {
        "application/json": { schema: batchUpdateResponseSchema(resourceCloseoutSchema) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const batchDeleteCloseoutsRoute = createRoute({
  method: "post",
  path: "/closeouts/batch-delete",
  request: {
    body: { required: true, content: { "application/json": { schema: batchIdsSchema } } },
  },
  responses: {
    200: {
      description: "Per-id batch-delete results (missing ids reported under `failed`)",
      content: { "application/json": { schema: batchDeleteResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getCloseoutRoute = createRoute({
  method: "get",
  path: "/closeouts/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A resource closeout by id",
      content: { "application/json": { schema: z.object({ data: resourceCloseoutSchema }) } },
    },
    404: {
      description: "Resource closeout not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateCloseoutRoute = createRoute({
  method: "patch",
  path: "/closeouts/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateResourceCloseoutSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated resource closeout",
      content: { "application/json": { schema: z.object({ data: resourceCloseoutSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Resource closeout or referenced resource not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteCloseoutRoute = createRoute({
  method: "delete",
  path: "/closeouts/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Resource closeout deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Resource closeout not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const closeoutRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listCloseoutsRoute, async (c) =>
    c.json(await resourcesService.listCloseouts(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createCloseoutRoute, async (c) => {
    try {
      const row = await resourcesService.createCloseout(c.get("db"), c.req.valid("json"))
      return c.json({ data: row! }, 201)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(batchUpdateCloseoutsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateCloseout,
      }),
      200,
    )
  })
  .openapi(batchDeleteCloseoutsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteCloseout,
      }),
      200,
    )
  })
  .openapi(getCloseoutRoute, async (c) => {
    const row = await resourcesService.getCloseoutById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Resource closeout not found" }, 404)
  })
  .openapi(updateCloseoutRoute, async (c) => {
    try {
      const row = await resourcesService.updateCloseout(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Resource closeout not found" }, 404)
    } catch (error) {
      return handleResourcesNotFoundRouteError(c, error)
    }
  })
  .openapi(deleteCloseoutRoute, async (c) => {
    const row = await resourcesService.deleteCloseout(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Resource closeout not found" }, 404)
  })

/**
 * Compose the per-resource sub-chains onto a single `OpenAPIHono` so the
 * `.openapi()` operations propagate up through the parent operations registries
 * (`OpenAPIHono.route` copies the sub-app's registered routes).
 */
export const resourcesRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", resourceRoutes)
  .route("/", poolRoutes)
  .route("/", poolMemberRoutes)
  .route("/", requirementRoutes)
  .route("/", allocationRoutes)
  .route("/", slotAssignmentRoutes)
  .route("/", closeoutRoutes)

export type ResourcesRoutes = typeof resourcesRoutes
