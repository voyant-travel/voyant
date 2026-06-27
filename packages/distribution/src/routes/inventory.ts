/**
 * Distribution inventory admin routes — channel inventory allotments, allotment
 * targets, and release rules (CRUD + batch). Migrated to `@hono/zod-openapi`
 * for the OpenAPI admin backfill (voyant#2114 — distribution sub-batch); the
 * exported `inventoryRoutes` `OpenAPIHono` instance is composed onto
 * `distributionRoutes` via `.route("/")`, so it rides the same dual-mount
 * (`/v1/distribution/*` legacy + `/v1/admin/distribution/*` documented). Each
 * resource is its own small sub-chain mounted via `.route("/")` to bound tsc
 * inference cost. Request schemas reuse `validation.ts`; response row schemas
 * live in `openapi-schemas.ts`. Handlers read `c.req.valid(...)`.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { distributionService } from "../service.js"
import {
  channelInventoryAllotmentListQuerySchema,
  channelInventoryAllotmentTargetListQuerySchema,
  channelInventoryReleaseRuleListQuerySchema,
  insertChannelInventoryAllotmentSchema,
  insertChannelInventoryAllotmentTargetSchema,
  insertChannelInventoryReleaseRuleSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseRuleSchema,
} from "../validation.js"
import {
  batchIdsSchema,
  batchUpdateChannelInventoryAllotmentSchema,
  batchUpdateChannelInventoryAllotmentTargetSchema,
  batchUpdateChannelInventoryReleaseRuleSchema,
  handleBatchDelete,
  handleBatchUpdate,
} from "./batch.js"
import type { DistributionRouteEnv } from "./env.js"
import {
  batchDeleteResponseSchema,
  batchUpdateResponseSchema,
  channelInventoryAllotmentSchema,
  channelInventoryAllotmentTargetSchema,
  channelInventoryReleaseRuleSchema,
  errorResponseSchema,
  idParamSchema,
  successResponseSchema,
} from "./openapi-schemas.js"

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

// --- inventory allotments ---------------------------------------------------

const listAllotmentsRoute = createRoute({
  method: "get",
  path: "/inventory-allotments",
  request: { query: channelInventoryAllotmentListQuerySchema },
  responses: {
    200: {
      description: "Paginated inventory allotments",
      ...jsonContent(listResponseSchema(channelInventoryAllotmentSchema)),
    },
  },
})

const createAllotmentRoute = createRoute({
  method: "post",
  path: "/inventory-allotments",
  request: requiredJsonBody(insertChannelInventoryAllotmentSchema),
  responses: {
    201: {
      description: "The created inventory allotment",
      ...jsonContent(z.object({ data: channelInventoryAllotmentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchUpdateAllotmentsRoute = createRoute({
  method: "post",
  path: "/inventory-allotments/batch-update",
  request: requiredJsonBody(batchUpdateChannelInventoryAllotmentSchema),
  responses: {
    200: {
      description: "Per-id batch-update results",
      ...jsonContent(batchUpdateResponseSchema(channelInventoryAllotmentSchema)),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchDeleteAllotmentsRoute = createRoute({
  method: "post",
  path: "/inventory-allotments/batch-delete",
  request: requiredJsonBody(batchIdsSchema),
  responses: {
    200: { description: "Per-id batch-delete results", ...jsonContent(batchDeleteResponseSchema) },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getAllotmentRoute = createRoute({
  method: "get",
  path: "/inventory-allotments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An inventory allotment by id",
      ...jsonContent(z.object({ data: channelInventoryAllotmentSchema })),
    },
    404: {
      description: "Channel inventory allotment not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateAllotmentRoute = createRoute({
  method: "patch",
  path: "/inventory-allotments/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelInventoryAllotmentSchema) },
  responses: {
    200: {
      description: "The updated inventory allotment",
      ...jsonContent(z.object({ data: channelInventoryAllotmentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel inventory allotment not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteAllotmentRoute = createRoute({
  method: "delete",
  path: "/inventory-allotments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Inventory allotment deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel inventory allotment not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const allotmentRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listAllotmentsRoute, async (c) =>
    c.json(
      await distributionService.listInventoryAllotments(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createAllotmentRoute, async (c) => {
    const row = await distributionService.createInventoryAllotment(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateAllotmentsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryAllotment,
      }),
      200,
    )
  })
  .openapi(batchDeleteAllotmentsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryAllotment,
      }),
      200,
    )
  })
  .openapi(getAllotmentRoute, async (c) => {
    const row = await distributionService.getInventoryAllotmentById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory allotment not found" }, 404)
  })
  .openapi(updateAllotmentRoute, async (c) => {
    const row = await distributionService.updateInventoryAllotment(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory allotment not found" }, 404)
  })
  .openapi(deleteAllotmentRoute, async (c) => {
    const row = await distributionService.deleteInventoryAllotment(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel inventory allotment not found" }, 404)
  })

// --- inventory allotment targets --------------------------------------------

const listTargetsRoute = createRoute({
  method: "get",
  path: "/inventory-allotment-targets",
  request: { query: channelInventoryAllotmentTargetListQuerySchema },
  responses: {
    200: {
      description: "Paginated inventory allotment targets",
      ...jsonContent(listResponseSchema(channelInventoryAllotmentTargetSchema)),
    },
  },
})

const createTargetRoute = createRoute({
  method: "post",
  path: "/inventory-allotment-targets",
  request: requiredJsonBody(insertChannelInventoryAllotmentTargetSchema),
  responses: {
    201: {
      description: "The created inventory allotment target",
      ...jsonContent(z.object({ data: channelInventoryAllotmentTargetSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchUpdateTargetsRoute = createRoute({
  method: "post",
  path: "/inventory-allotment-targets/batch-update",
  request: requiredJsonBody(batchUpdateChannelInventoryAllotmentTargetSchema),
  responses: {
    200: {
      description: "Per-id batch-update results",
      ...jsonContent(batchUpdateResponseSchema(channelInventoryAllotmentTargetSchema)),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchDeleteTargetsRoute = createRoute({
  method: "post",
  path: "/inventory-allotment-targets/batch-delete",
  request: requiredJsonBody(batchIdsSchema),
  responses: {
    200: { description: "Per-id batch-delete results", ...jsonContent(batchDeleteResponseSchema) },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getTargetRoute = createRoute({
  method: "get",
  path: "/inventory-allotment-targets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An inventory allotment target by id",
      ...jsonContent(z.object({ data: channelInventoryAllotmentTargetSchema })),
    },
    404: {
      description: "Channel inventory allotment target not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateTargetRoute = createRoute({
  method: "patch",
  path: "/inventory-allotment-targets/{id}",
  request: {
    params: idParamSchema,
    ...requiredJsonBody(updateChannelInventoryAllotmentTargetSchema),
  },
  responses: {
    200: {
      description: "The updated inventory allotment target",
      ...jsonContent(z.object({ data: channelInventoryAllotmentTargetSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel inventory allotment target not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteTargetRoute = createRoute({
  method: "delete",
  path: "/inventory-allotment-targets/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Inventory allotment target deleted",
      ...jsonContent(successResponseSchema),
    },
    404: {
      description: "Channel inventory allotment target not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const targetRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listTargetsRoute, async (c) =>
    c.json(
      await distributionService.listInventoryAllotmentTargets(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createTargetRoute, async (c) => {
    const row = await distributionService.createInventoryAllotmentTarget(
      c.get("db"),
      c.req.valid("json"),
    )
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateTargetsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryAllotmentTarget,
      }),
      200,
    )
  })
  .openapi(batchDeleteTargetsRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryAllotmentTarget,
      }),
      200,
    )
  })
  .openapi(getTargetRoute, async (c) => {
    const row = await distributionService.getInventoryAllotmentTargetById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory allotment target not found" }, 404)
  })
  .openapi(updateTargetRoute, async (c) => {
    const row = await distributionService.updateInventoryAllotmentTarget(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory allotment target not found" }, 404)
  })
  .openapi(deleteTargetRoute, async (c) => {
    const row = await distributionService.deleteInventoryAllotmentTarget(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel inventory allotment target not found" }, 404)
  })

// --- inventory release rules ------------------------------------------------

const listReleaseRulesRoute = createRoute({
  method: "get",
  path: "/inventory-release-rules",
  request: { query: channelInventoryReleaseRuleListQuerySchema },
  responses: {
    200: {
      description: "Paginated inventory release rules",
      ...jsonContent(listResponseSchema(channelInventoryReleaseRuleSchema)),
    },
  },
})

const createReleaseRuleRoute = createRoute({
  method: "post",
  path: "/inventory-release-rules",
  request: requiredJsonBody(insertChannelInventoryReleaseRuleSchema),
  responses: {
    201: {
      description: "The created inventory release rule",
      ...jsonContent(z.object({ data: channelInventoryReleaseRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchUpdateReleaseRulesRoute = createRoute({
  method: "post",
  path: "/inventory-release-rules/batch-update",
  request: requiredJsonBody(batchUpdateChannelInventoryReleaseRuleSchema),
  responses: {
    200: {
      description: "Per-id batch-update results",
      ...jsonContent(batchUpdateResponseSchema(channelInventoryReleaseRuleSchema)),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const batchDeleteReleaseRulesRoute = createRoute({
  method: "post",
  path: "/inventory-release-rules/batch-delete",
  request: requiredJsonBody(batchIdsSchema),
  responses: {
    200: { description: "Per-id batch-delete results", ...jsonContent(batchDeleteResponseSchema) },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReleaseRuleRoute = createRoute({
  method: "get",
  path: "/inventory-release-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An inventory release rule by id",
      ...jsonContent(z.object({ data: channelInventoryReleaseRuleSchema })),
    },
    404: {
      description: "Channel inventory release rule not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateReleaseRuleRoute = createRoute({
  method: "patch",
  path: "/inventory-release-rules/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelInventoryReleaseRuleSchema) },
  responses: {
    200: {
      description: "The updated inventory release rule",
      ...jsonContent(z.object({ data: channelInventoryReleaseRuleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel inventory release rule not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteReleaseRuleRoute = createRoute({
  method: "delete",
  path: "/inventory-release-rules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Inventory release rule deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel inventory release rule not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const releaseRuleRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReleaseRulesRoute, async (c) =>
    c.json(
      await distributionService.listInventoryReleaseRules(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createReleaseRuleRoute, async (c) => {
    const row = await distributionService.createInventoryReleaseRule(
      c.get("db"),
      c.req.valid("json"),
    )
    return c.json({ data: row! }, 201)
  })
  .openapi(batchUpdateReleaseRulesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryReleaseRule,
      }),
      200,
    )
  })
  .openapi(batchDeleteReleaseRulesRoute, async (c) => {
    const body = c.req.valid("json")
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryReleaseRule,
      }),
      200,
    )
  })
  .openapi(getReleaseRuleRoute, async (c) => {
    const row = await distributionService.getInventoryReleaseRuleById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory release rule not found" }, 404)
  })
  .openapi(updateReleaseRuleRoute, async (c) => {
    const row = await distributionService.updateInventoryReleaseRule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory release rule not found" }, 404)
  })
  .openapi(deleteReleaseRuleRoute, async (c) => {
    const row = await distributionService.deleteInventoryReleaseRule(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel inventory release rule not found" }, 404)
  })

export const inventoryRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .route("/", allotmentRoutes)
  .route("/", targetRoutes)
  .route("/", releaseRuleRoutes)
