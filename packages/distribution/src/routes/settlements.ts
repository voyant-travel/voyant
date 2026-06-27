/**
 * Distribution settlement / reconciliation admin routes — settlement runs +
 * items, reconciliation runs + items, inventory release executions, and the
 * settlement/reconciliation policies, release schedules, remittance exceptions,
 * and settlement approvals (list/create/get/patch/delete each; no batch).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * distribution sub-batch); the exported `settlementRoutes` `OpenAPIHono`
 * instance is composed onto `distributionRoutes` via `.route("/")`, so it rides
 * the same dual-mount (`/v1/distribution/*` legacy + `/v1/admin/distribution/*`
 * documented). Each resource is its own small sub-chain mounted via
 * `.route("/")` to bound tsc inference cost. Request schemas reuse
 * `validation.ts`; response row schemas live in `openapi-schemas.ts`. Handlers
 * read `c.req.valid(...)`.
 *
 * agent-quality: file-size exception — intentional: a mechanically-repetitive
 * CRUD bundle over ten settlement/reconciliation resources, each with a
 * `createRoute` def + co-located handler per the established admin route
 * pattern. Splitting per resource would fragment the single mounted instance
 * without aiding review. See voyant#2114 (distribution sub-batch).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { distributionService } from "../service.js"
import {
  channelInventoryReleaseExecutionListQuerySchema,
  channelReconciliationItemListQuerySchema,
  channelReconciliationPolicyListQuerySchema,
  channelReconciliationRunListQuerySchema,
  channelReleaseScheduleListQuerySchema,
  channelRemittanceExceptionListQuerySchema,
  channelSettlementApprovalListQuerySchema,
  channelSettlementItemListQuerySchema,
  channelSettlementPolicyListQuerySchema,
  channelSettlementRunListQuerySchema,
  insertChannelInventoryReleaseExecutionSchema,
  insertChannelReconciliationItemSchema,
  insertChannelReconciliationPolicySchema,
  insertChannelReconciliationRunSchema,
  insertChannelReleaseScheduleSchema,
  insertChannelRemittanceExceptionSchema,
  insertChannelSettlementApprovalSchema,
  insertChannelSettlementItemSchema,
  insertChannelSettlementPolicySchema,
  insertChannelSettlementRunSchema,
  updateChannelInventoryReleaseExecutionSchema,
  updateChannelReconciliationItemSchema,
  updateChannelReconciliationPolicySchema,
  updateChannelReconciliationRunSchema,
  updateChannelReleaseScheduleSchema,
  updateChannelRemittanceExceptionSchema,
  updateChannelSettlementApprovalSchema,
  updateChannelSettlementItemSchema,
  updateChannelSettlementPolicySchema,
  updateChannelSettlementRunSchema,
} from "../validation.js"
import type { DistributionRouteEnv } from "./env.js"
import {
  channelInventoryReleaseExecutionSchema,
  channelReconciliationItemSchema,
  channelReconciliationPolicySchema,
  channelReconciliationRunSchema,
  channelReleaseScheduleSchema,
  channelRemittanceExceptionSchema,
  channelSettlementApprovalSchema,
  channelSettlementItemSchema,
  channelSettlementPolicySchema,
  channelSettlementRunSchema,
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

// --- settlement runs --------------------------------------------------------

const listSettlementRunsRoute = createRoute({
  method: "get",
  path: "/settlement-runs",
  request: { query: channelSettlementRunListQuerySchema },
  responses: {
    200: {
      description: "Paginated settlement runs",
      ...jsonContent(listResponseSchema(channelSettlementRunSchema)),
    },
  },
})

const createSettlementRunRoute = createRoute({
  method: "post",
  path: "/settlement-runs",
  request: requiredJsonBody(insertChannelSettlementRunSchema),
  responses: {
    201: {
      description: "The created settlement run",
      ...jsonContent(z.object({ data: channelSettlementRunSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getSettlementRunRoute = createRoute({
  method: "get",
  path: "/settlement-runs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A settlement run by id",
      ...jsonContent(z.object({ data: channelSettlementRunSchema })),
    },
    404: { description: "Channel settlement run not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateSettlementRunRoute = createRoute({
  method: "patch",
  path: "/settlement-runs/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelSettlementRunSchema) },
  responses: {
    200: {
      description: "The updated settlement run",
      ...jsonContent(z.object({ data: channelSettlementRunSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Channel settlement run not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteSettlementRunRoute = createRoute({
  method: "delete",
  path: "/settlement-runs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Settlement run deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Channel settlement run not found", ...jsonContent(errorResponseSchema) },
  },
})

const settlementRunRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listSettlementRunsRoute, async (c) =>
    c.json(await distributionService.listSettlementRuns(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSettlementRunRoute, async (c) => {
    const row = await distributionService.createSettlementRun(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getSettlementRunRoute, async (c) => {
    const row = await distributionService.getSettlementRunById(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement run not found" }, 404)
  })
  .openapi(updateSettlementRunRoute, async (c) => {
    const row = await distributionService.updateSettlementRun(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement run not found" }, 404)
  })
  .openapi(deleteSettlementRunRoute, async (c) => {
    const row = await distributionService.deleteSettlementRun(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel settlement run not found" }, 404)
  })

// --- settlement items -------------------------------------------------------

const listSettlementItemsRoute = createRoute({
  method: "get",
  path: "/settlement-items",
  request: { query: channelSettlementItemListQuerySchema },
  responses: {
    200: {
      description: "Paginated settlement items",
      ...jsonContent(listResponseSchema(channelSettlementItemSchema)),
    },
  },
})

const createSettlementItemRoute = createRoute({
  method: "post",
  path: "/settlement-items",
  request: requiredJsonBody(insertChannelSettlementItemSchema),
  responses: {
    201: {
      description: "The created settlement item",
      ...jsonContent(z.object({ data: channelSettlementItemSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getSettlementItemRoute = createRoute({
  method: "get",
  path: "/settlement-items/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A settlement item by id",
      ...jsonContent(z.object({ data: channelSettlementItemSchema })),
    },
    404: { description: "Channel settlement item not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateSettlementItemRoute = createRoute({
  method: "patch",
  path: "/settlement-items/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelSettlementItemSchema) },
  responses: {
    200: {
      description: "The updated settlement item",
      ...jsonContent(z.object({ data: channelSettlementItemSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Channel settlement item not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteSettlementItemRoute = createRoute({
  method: "delete",
  path: "/settlement-items/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Settlement item deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Channel settlement item not found", ...jsonContent(errorResponseSchema) },
  },
})

const settlementItemRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listSettlementItemsRoute, async (c) =>
    c.json(await distributionService.listSettlementItems(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createSettlementItemRoute, async (c) => {
    const row = await distributionService.createSettlementItem(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getSettlementItemRoute, async (c) => {
    const row = await distributionService.getSettlementItemById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement item not found" }, 404)
  })
  .openapi(updateSettlementItemRoute, async (c) => {
    const row = await distributionService.updateSettlementItem(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement item not found" }, 404)
  })
  .openapi(deleteSettlementItemRoute, async (c) => {
    const row = await distributionService.deleteSettlementItem(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel settlement item not found" }, 404)
  })

// --- reconciliation runs ----------------------------------------------------

const listReconciliationRunsRoute = createRoute({
  method: "get",
  path: "/reconciliation-runs",
  request: { query: channelReconciliationRunListQuerySchema },
  responses: {
    200: {
      description: "Paginated reconciliation runs",
      ...jsonContent(listResponseSchema(channelReconciliationRunSchema)),
    },
  },
})

const createReconciliationRunRoute = createRoute({
  method: "post",
  path: "/reconciliation-runs",
  request: requiredJsonBody(insertChannelReconciliationRunSchema),
  responses: {
    201: {
      description: "The created reconciliation run",
      ...jsonContent(z.object({ data: channelReconciliationRunSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReconciliationRunRoute = createRoute({
  method: "get",
  path: "/reconciliation-runs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A reconciliation run by id",
      ...jsonContent(z.object({ data: channelReconciliationRunSchema })),
    },
    404: {
      description: "Channel reconciliation run not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateReconciliationRunRoute = createRoute({
  method: "patch",
  path: "/reconciliation-runs/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelReconciliationRunSchema) },
  responses: {
    200: {
      description: "The updated reconciliation run",
      ...jsonContent(z.object({ data: channelReconciliationRunSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel reconciliation run not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteReconciliationRunRoute = createRoute({
  method: "delete",
  path: "/reconciliation-runs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Reconciliation run deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel reconciliation run not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const reconciliationRunRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReconciliationRunsRoute, async (c) =>
    c.json(
      await distributionService.listReconciliationRuns(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createReconciliationRunRoute, async (c) => {
    const row = await distributionService.createReconciliationRun(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getReconciliationRunRoute, async (c) => {
    const row = await distributionService.getReconciliationRunById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation run not found" }, 404)
  })
  .openapi(updateReconciliationRunRoute, async (c) => {
    const row = await distributionService.updateReconciliationRun(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation run not found" }, 404)
  })
  .openapi(deleteReconciliationRunRoute, async (c) => {
    const row = await distributionService.deleteReconciliationRun(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel reconciliation run not found" }, 404)
  })

// --- reconciliation items ---------------------------------------------------

const listReconciliationItemsRoute = createRoute({
  method: "get",
  path: "/reconciliation-items",
  request: { query: channelReconciliationItemListQuerySchema },
  responses: {
    200: {
      description: "Paginated reconciliation items",
      ...jsonContent(listResponseSchema(channelReconciliationItemSchema)),
    },
  },
})

const createReconciliationItemRoute = createRoute({
  method: "post",
  path: "/reconciliation-items",
  request: requiredJsonBody(insertChannelReconciliationItemSchema),
  responses: {
    201: {
      description: "The created reconciliation item",
      ...jsonContent(z.object({ data: channelReconciliationItemSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReconciliationItemRoute = createRoute({
  method: "get",
  path: "/reconciliation-items/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A reconciliation item by id",
      ...jsonContent(z.object({ data: channelReconciliationItemSchema })),
    },
    404: {
      description: "Channel reconciliation item not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateReconciliationItemRoute = createRoute({
  method: "patch",
  path: "/reconciliation-items/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelReconciliationItemSchema) },
  responses: {
    200: {
      description: "The updated reconciliation item",
      ...jsonContent(z.object({ data: channelReconciliationItemSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel reconciliation item not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteReconciliationItemRoute = createRoute({
  method: "delete",
  path: "/reconciliation-items/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Reconciliation item deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel reconciliation item not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const reconciliationItemRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReconciliationItemsRoute, async (c) =>
    c.json(
      await distributionService.listReconciliationItems(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createReconciliationItemRoute, async (c) => {
    const row = await distributionService.createReconciliationItem(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getReconciliationItemRoute, async (c) => {
    const row = await distributionService.getReconciliationItemById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation item not found" }, 404)
  })
  .openapi(updateReconciliationItemRoute, async (c) => {
    const row = await distributionService.updateReconciliationItem(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation item not found" }, 404)
  })
  .openapi(deleteReconciliationItemRoute, async (c) => {
    const row = await distributionService.deleteReconciliationItem(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel reconciliation item not found" }, 404)
  })

// --- inventory release executions -------------------------------------------

const listReleaseExecutionsRoute = createRoute({
  method: "get",
  path: "/inventory-release-executions",
  request: { query: channelInventoryReleaseExecutionListQuerySchema },
  responses: {
    200: {
      description: "Paginated inventory release executions",
      ...jsonContent(listResponseSchema(channelInventoryReleaseExecutionSchema)),
    },
  },
})

const createReleaseExecutionRoute = createRoute({
  method: "post",
  path: "/inventory-release-executions",
  request: requiredJsonBody(insertChannelInventoryReleaseExecutionSchema),
  responses: {
    201: {
      description: "The created inventory release execution",
      ...jsonContent(z.object({ data: channelInventoryReleaseExecutionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReleaseExecutionRoute = createRoute({
  method: "get",
  path: "/inventory-release-executions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An inventory release execution by id",
      ...jsonContent(z.object({ data: channelInventoryReleaseExecutionSchema })),
    },
    404: {
      description: "Channel inventory release execution not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateReleaseExecutionRoute = createRoute({
  method: "patch",
  path: "/inventory-release-executions/{id}",
  request: {
    params: idParamSchema,
    ...requiredJsonBody(updateChannelInventoryReleaseExecutionSchema),
  },
  responses: {
    200: {
      description: "The updated inventory release execution",
      ...jsonContent(z.object({ data: channelInventoryReleaseExecutionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel inventory release execution not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteReleaseExecutionRoute = createRoute({
  method: "delete",
  path: "/inventory-release-executions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Inventory release execution deleted",
      ...jsonContent(successResponseSchema),
    },
    404: {
      description: "Channel inventory release execution not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const releaseExecutionRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReleaseExecutionsRoute, async (c) =>
    c.json(await distributionService.listReleaseExecutions(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createReleaseExecutionRoute, async (c) => {
    const row = await distributionService.createReleaseExecution(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getReleaseExecutionRoute, async (c) => {
    const row = await distributionService.getReleaseExecutionById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory release execution not found" }, 404)
  })
  .openapi(updateReleaseExecutionRoute, async (c) => {
    const row = await distributionService.updateReleaseExecution(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel inventory release execution not found" }, 404)
  })
  .openapi(deleteReleaseExecutionRoute, async (c) => {
    const row = await distributionService.deleteReleaseExecution(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel inventory release execution not found" }, 404)
  })

// --- settlement policies -----------------------------------------------------

const listSettlementPoliciesRoute = createRoute({
  method: "get",
  path: "/settlement-policies",
  request: { query: channelSettlementPolicyListQuerySchema },
  responses: {
    200: {
      description: "Paginated settlement policies",
      ...jsonContent(listResponseSchema(channelSettlementPolicySchema)),
    },
  },
})

const createSettlementPolicyRoute = createRoute({
  method: "post",
  path: "/settlement-policies",
  request: requiredJsonBody(insertChannelSettlementPolicySchema),
  responses: {
    201: {
      description: "The created settlement policy",
      ...jsonContent(z.object({ data: channelSettlementPolicySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getSettlementPolicyRoute = createRoute({
  method: "get",
  path: "/settlement-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A settlement policy by id",
      ...jsonContent(z.object({ data: channelSettlementPolicySchema })),
    },
    404: {
      description: "Channel settlement policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateSettlementPolicyRoute = createRoute({
  method: "patch",
  path: "/settlement-policies/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelSettlementPolicySchema) },
  responses: {
    200: {
      description: "The updated settlement policy",
      ...jsonContent(z.object({ data: channelSettlementPolicySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel settlement policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteSettlementPolicyRoute = createRoute({
  method: "delete",
  path: "/settlement-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Settlement policy deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel settlement policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const settlementPolicyRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listSettlementPoliciesRoute, async (c) =>
    c.json(
      await distributionService.listSettlementPolicies(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createSettlementPolicyRoute, async (c) => {
    const row = await distributionService.createSettlementPolicy(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getSettlementPolicyRoute, async (c) => {
    const row = await distributionService.getSettlementPolicyById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement policy not found" }, 404)
  })
  .openapi(updateSettlementPolicyRoute, async (c) => {
    const row = await distributionService.updateSettlementPolicy(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement policy not found" }, 404)
  })
  .openapi(deleteSettlementPolicyRoute, async (c) => {
    const row = await distributionService.deleteSettlementPolicy(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel settlement policy not found" }, 404)
  })

// --- reconciliation policies ------------------------------------------------

const listReconciliationPoliciesRoute = createRoute({
  method: "get",
  path: "/reconciliation-policies",
  request: { query: channelReconciliationPolicyListQuerySchema },
  responses: {
    200: {
      description: "Paginated reconciliation policies",
      ...jsonContent(listResponseSchema(channelReconciliationPolicySchema)),
    },
  },
})

const createReconciliationPolicyRoute = createRoute({
  method: "post",
  path: "/reconciliation-policies",
  request: requiredJsonBody(insertChannelReconciliationPolicySchema),
  responses: {
    201: {
      description: "The created reconciliation policy",
      ...jsonContent(z.object({ data: channelReconciliationPolicySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReconciliationPolicyRoute = createRoute({
  method: "get",
  path: "/reconciliation-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A reconciliation policy by id",
      ...jsonContent(z.object({ data: channelReconciliationPolicySchema })),
    },
    404: {
      description: "Channel reconciliation policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateReconciliationPolicyRoute = createRoute({
  method: "patch",
  path: "/reconciliation-policies/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelReconciliationPolicySchema) },
  responses: {
    200: {
      description: "The updated reconciliation policy",
      ...jsonContent(z.object({ data: channelReconciliationPolicySchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel reconciliation policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteReconciliationPolicyRoute = createRoute({
  method: "delete",
  path: "/reconciliation-policies/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Reconciliation policy deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel reconciliation policy not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const reconciliationPolicyRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReconciliationPoliciesRoute, async (c) =>
    c.json(
      await distributionService.listReconciliationPolicies(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createReconciliationPolicyRoute, async (c) => {
    const row = await distributionService.createReconciliationPolicy(
      c.get("db"),
      c.req.valid("json"),
    )
    return c.json({ data: row! }, 201)
  })
  .openapi(getReconciliationPolicyRoute, async (c) => {
    const row = await distributionService.getReconciliationPolicyById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation policy not found" }, 404)
  })
  .openapi(updateReconciliationPolicyRoute, async (c) => {
    const row = await distributionService.updateReconciliationPolicy(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel reconciliation policy not found" }, 404)
  })
  .openapi(deleteReconciliationPolicyRoute, async (c) => {
    const row = await distributionService.deleteReconciliationPolicy(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel reconciliation policy not found" }, 404)
  })

// --- release schedules ------------------------------------------------------

const listReleaseSchedulesRoute = createRoute({
  method: "get",
  path: "/release-schedules",
  request: { query: channelReleaseScheduleListQuerySchema },
  responses: {
    200: {
      description: "Paginated release schedules",
      ...jsonContent(listResponseSchema(channelReleaseScheduleSchema)),
    },
  },
})

const createReleaseScheduleRoute = createRoute({
  method: "post",
  path: "/release-schedules",
  request: requiredJsonBody(insertChannelReleaseScheduleSchema),
  responses: {
    201: {
      description: "The created release schedule",
      ...jsonContent(z.object({ data: channelReleaseScheduleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getReleaseScheduleRoute = createRoute({
  method: "get",
  path: "/release-schedules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A release schedule by id",
      ...jsonContent(z.object({ data: channelReleaseScheduleSchema })),
    },
    404: { description: "Channel release schedule not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateReleaseScheduleRoute = createRoute({
  method: "patch",
  path: "/release-schedules/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelReleaseScheduleSchema) },
  responses: {
    200: {
      description: "The updated release schedule",
      ...jsonContent(z.object({ data: channelReleaseScheduleSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Channel release schedule not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteReleaseScheduleRoute = createRoute({
  method: "delete",
  path: "/release-schedules/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Release schedule deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Channel release schedule not found", ...jsonContent(errorResponseSchema) },
  },
})

const releaseScheduleRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listReleaseSchedulesRoute, async (c) =>
    c.json(await distributionService.listReleaseSchedules(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createReleaseScheduleRoute, async (c) => {
    const row = await distributionService.createReleaseSchedule(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getReleaseScheduleRoute, async (c) => {
    const row = await distributionService.getReleaseScheduleById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel release schedule not found" }, 404)
  })
  .openapi(updateReleaseScheduleRoute, async (c) => {
    const row = await distributionService.updateReleaseSchedule(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel release schedule not found" }, 404)
  })
  .openapi(deleteReleaseScheduleRoute, async (c) => {
    const row = await distributionService.deleteReleaseSchedule(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel release schedule not found" }, 404)
  })

// --- remittance exceptions --------------------------------------------------

const listRemittanceExceptionsRoute = createRoute({
  method: "get",
  path: "/remittance-exceptions",
  request: { query: channelRemittanceExceptionListQuerySchema },
  responses: {
    200: {
      description: "Paginated remittance exceptions",
      ...jsonContent(listResponseSchema(channelRemittanceExceptionSchema)),
    },
  },
})

const createRemittanceExceptionRoute = createRoute({
  method: "post",
  path: "/remittance-exceptions",
  request: requiredJsonBody(insertChannelRemittanceExceptionSchema),
  responses: {
    201: {
      description: "The created remittance exception",
      ...jsonContent(z.object({ data: channelRemittanceExceptionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getRemittanceExceptionRoute = createRoute({
  method: "get",
  path: "/remittance-exceptions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A remittance exception by id",
      ...jsonContent(z.object({ data: channelRemittanceExceptionSchema })),
    },
    404: {
      description: "Channel remittance exception not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateRemittanceExceptionRoute = createRoute({
  method: "patch",
  path: "/remittance-exceptions/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelRemittanceExceptionSchema) },
  responses: {
    200: {
      description: "The updated remittance exception",
      ...jsonContent(z.object({ data: channelRemittanceExceptionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel remittance exception not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteRemittanceExceptionRoute = createRoute({
  method: "delete",
  path: "/remittance-exceptions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Remittance exception deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel remittance exception not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const remittanceExceptionRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listRemittanceExceptionsRoute, async (c) =>
    c.json(
      await distributionService.listRemittanceExceptions(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createRemittanceExceptionRoute, async (c) => {
    const row = await distributionService.createRemittanceException(
      c.get("db"),
      c.req.valid("json"),
    )
    return c.json({ data: row! }, 201)
  })
  .openapi(getRemittanceExceptionRoute, async (c) => {
    const row = await distributionService.getRemittanceExceptionById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel remittance exception not found" }, 404)
  })
  .openapi(updateRemittanceExceptionRoute, async (c) => {
    const row = await distributionService.updateRemittanceException(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel remittance exception not found" }, 404)
  })
  .openapi(deleteRemittanceExceptionRoute, async (c) => {
    const row = await distributionService.deleteRemittanceException(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel remittance exception not found" }, 404)
  })

// --- settlement approvals ---------------------------------------------------

const listSettlementApprovalsRoute = createRoute({
  method: "get",
  path: "/settlement-approvals",
  request: { query: channelSettlementApprovalListQuerySchema },
  responses: {
    200: {
      description: "Paginated settlement approvals",
      ...jsonContent(listResponseSchema(channelSettlementApprovalSchema)),
    },
  },
})

const createSettlementApprovalRoute = createRoute({
  method: "post",
  path: "/settlement-approvals",
  request: requiredJsonBody(insertChannelSettlementApprovalSchema),
  responses: {
    201: {
      description: "The created settlement approval",
      ...jsonContent(z.object({ data: channelSettlementApprovalSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getSettlementApprovalRoute = createRoute({
  method: "get",
  path: "/settlement-approvals/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A settlement approval by id",
      ...jsonContent(z.object({ data: channelSettlementApprovalSchema })),
    },
    404: {
      description: "Channel settlement approval not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const updateSettlementApprovalRoute = createRoute({
  method: "patch",
  path: "/settlement-approvals/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateChannelSettlementApprovalSchema) },
  responses: {
    200: {
      description: "The updated settlement approval",
      ...jsonContent(z.object({ data: channelSettlementApprovalSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: {
      description: "Channel settlement approval not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const deleteSettlementApprovalRoute = createRoute({
  method: "delete",
  path: "/settlement-approvals/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Settlement approval deleted", ...jsonContent(successResponseSchema) },
    404: {
      description: "Channel settlement approval not found",
      ...jsonContent(errorResponseSchema),
    },
  },
})

const settlementApprovalRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listSettlementApprovalsRoute, async (c) =>
    c.json(
      await distributionService.listSettlementApprovals(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(createSettlementApprovalRoute, async (c) => {
    const row = await distributionService.createSettlementApproval(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getSettlementApprovalRoute, async (c) => {
    const row = await distributionService.getSettlementApprovalById(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement approval not found" }, 404)
  })
  .openapi(updateSettlementApprovalRoute, async (c) => {
    const row = await distributionService.updateSettlementApproval(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Channel settlement approval not found" }, 404)
  })
  .openapi(deleteSettlementApprovalRoute, async (c) => {
    const row = await distributionService.deleteSettlementApproval(
      c.get("db"),
      c.req.valid("param").id,
    )
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Channel settlement approval not found" }, 404)
  })

export const settlementRoutes = new OpenAPIHono<DistributionRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .route("/", settlementRunRoutes)
  .route("/", settlementItemRoutes)
  .route("/", reconciliationRunRoutes)
  .route("/", reconciliationItemRoutes)
  .route("/", releaseExecutionRoutes)
  .route("/", settlementPolicyRoutes)
  .route("/", reconciliationPolicyRoutes)
  .route("/", releaseScheduleRoutes)
  .route("/", remittanceExceptionRoutes)
  .route("/", settlementApprovalRoutes)
