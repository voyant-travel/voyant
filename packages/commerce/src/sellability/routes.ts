/**
 * Sellability admin routes, owned by `@voyant-travel/commerce`. Mounted by the
 * framework composition as the `sellability` runtime module at `/v1/sellability`
 * (legacy `/v1/*` surface — appears in the `full` OpenAPI document).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * commerce sellability sub-batch). Request schemas reuse the existing
 * `./validation.js` schemas the handlers already parse; response row schemas are
 * authored from the Drizzle `$inferSelect` shapes in `schema.ts` (§17:
 * `Date`/timestamp columns serialize to ISO strings over the wire;
 * integer/double columns stay numbers; `jsonb` columns are records). LIST
 * endpoints go through the shared `paginate(...)` helper which returns the
 * `{ data, total, limit, offset }` envelope, so they declare
 * `listResponseSchema(...)`. The `resolve` / `resolve-and-persist` legs return a
 * `{ data, meta }` candidate envelope (not a table row), so their candidate
 * payloads are documented as opaque (`z.unknown()`) — only the envelope shape is
 * contractual.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain). Business logic is unchanged; handlers
 * read `c.req.valid(...)`.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { sellabilityService } from "./service.js"
import {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerExpirationEventStatusSchema,
  offerRefreshRunListQuerySchema,
  offerRefreshRunStatusSchema,
  sellabilityExplanationListQuerySchema,
  sellabilityExplanationTypeSchema,
  sellabilityPersistSnapshotSchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  sellabilityPolicyResultStatusSchema,
  sellabilityPolicyScopeSchema,
  sellabilityPolicyTypeSchema,
  sellabilityResolveQuerySchema,
  sellabilitySnapshotItemListQuerySchema,
  sellabilitySnapshotListQuerySchema,
  sellabilitySnapshotStatusSchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface SellabilityRoutesOptions {
  service?: typeof sellabilityService
}

const errorResponseSchema = z.object({ error: z.string() })
const successSchema = z.object({ success: z.boolean() })
const idParamSchema = z.object({ id: z.string() })

/** §17: timestamp columns serialize to ISO strings over the wire. */
const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

const snapshotComponentKindSchema = z.enum(["base", "unit", "pickup", "start_time_adjustment"])

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const snapshotSchema = z.object({
  id: z.string(),
  offerId: z.string().nullable(),
  marketId: z.string().nullable(),
  channelId: z.string().nullable(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  slotId: z.string().nullable(),
  requestedCurrencyCode: z.string().nullable(),
  sourceCurrencyCode: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  status: sellabilitySnapshotStatusSchema,
  queryPayload: jsonRecord,
  pricingSummary: jsonRecord,
  expiresAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const snapshotItemSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  candidateIndex: z.number(),
  componentIndex: z.number(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  slotId: z.string().nullable(),
  unitId: z.string().nullable(),
  requestRef: z.string().nullable(),
  componentKind: snapshotComponentKindSchema,
  title: z.string(),
  quantity: z.number(),
  pricingMode: z.string(),
  pricingCategoryId: z.string().nullable(),
  pricingCategoryName: z.string().nullable(),
  unitName: z.string().nullable(),
  unitType: z.string().nullable(),
  currencyCode: z.string(),
  sellAmountCents: z.number(),
  costAmountCents: z.number(),
  sourceRuleId: z.string().nullable(),
  tierId: z.string().nullable(),
  isSelected: z.boolean(),
  createdAt: isoTimestamp,
})

const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: sellabilityPolicyScopeSchema,
  policyType: sellabilityPolicyTypeSchema,
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  marketId: z.string().nullable(),
  channelId: z.string().nullable(),
  priority: z.number(),
  active: z.boolean(),
  conditions: jsonRecord,
  effects: jsonRecord,
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyResultSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable(),
  policyId: z.string().nullable(),
  candidateIndex: z.number(),
  status: sellabilityPolicyResultStatusSchema,
  message: z.string().nullable(),
  details: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

const offerRefreshRunSchema = z.object({
  id: z.string(),
  offerId: z.string(),
  snapshotId: z.string().nullable(),
  status: offerRefreshRunStatusSchema,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const offerExpirationEventSchema = z.object({
  id: z.string(),
  offerId: z.string(),
  snapshotId: z.string().nullable(),
  expiresAt: isoTimestamp,
  expiredAt: isoTimestamp.nullable(),
  status: offerExpirationEventStatusSchema,
  reason: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const explanationSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable(),
  candidateIndex: z.number(),
  explanationType: sellabilityExplanationTypeSchema,
  code: z.string().nullable(),
  message: z.string(),
  details: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

/**
 * The resolve candidate envelope (`{ data, meta }`). Candidates are computed
 * pricing/availability projections, not table rows, so they are documented as
 * opaque — only the envelope is contractual.
 */
const resolveResultSchema = z.object({
  data: z.array(z.unknown()),
  meta: z.object({ total: z.number() }),
})

const persistResultSchema = z.object({
  snapshot: snapshotSchema,
  resolved: resolveResultSchema,
})

export function createSellabilityRoutes(options: SellabilityRoutesOptions = {}) {
  const service = options.service ?? sellabilityService

  // ========================================================================
  // Resolve + snapshots
  // ========================================================================

  const resolveRoute = createRoute({
    method: "post",
    path: "/resolve",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: sellabilityResolveQuerySchema } },
      },
    },
    responses: {
      200: {
        description: "Resolved sellability candidates",
        content: { "application/json": { schema: resolveResultSchema } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const resolveAndPersistRoute = createRoute({
    method: "post",
    path: "/resolve-and-persist",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: sellabilityPersistSnapshotSchema } },
      },
    },
    responses: {
      201: {
        description: "Resolved candidates plus the persisted snapshot",
        content: { "application/json": { schema: persistResultSchema } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const listSnapshotsRoute = createRoute({
    method: "get",
    path: "/snapshots",
    request: { query: sellabilitySnapshotListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of sellability snapshots",
        content: { "application/json": { schema: listResponseSchema(snapshotSchema) } },
      },
    },
  })

  const getSnapshotRoute = createRoute({
    method: "get",
    path: "/snapshots/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "A sellability snapshot by id",
        content: { "application/json": { schema: z.object({ data: snapshotSchema }) } },
      },
      404: {
        description: "Sellability snapshot not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const listSnapshotItemsRoute = createRoute({
    method: "get",
    path: "/snapshot-items",
    request: { query: sellabilitySnapshotItemListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of sellability snapshot items",
        content: { "application/json": { schema: listResponseSchema(snapshotItemSchema) } },
      },
    },
  })

  const snapshotRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(resolveRoute, async (c) =>
      c.json(await service.resolve(c.get("db"), c.req.valid("json")), 200),
    )
    .openapi(resolveAndPersistRoute, async (c) =>
      c.json(await service.persistSnapshot(c.get("db"), c.req.valid("json")), 201),
    )
    .openapi(listSnapshotsRoute, async (c) =>
      c.json(await service.listSnapshots(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(getSnapshotRoute, async (c) => {
      const row = await service.getSnapshotById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability snapshot not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(listSnapshotItemsRoute, async (c) =>
      c.json(await service.listSnapshotItems(c.get("db"), c.req.valid("query")), 200),
    )

  // ========================================================================
  // Policies
  // ========================================================================

  const listPoliciesRoute = createRoute({
    method: "get",
    path: "/policies",
    request: { query: sellabilityPolicyListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of sellability policies",
        content: { "application/json": { schema: listResponseSchema(policySchema) } },
      },
    },
  })

  const createPolicyRoute = createRoute({
    method: "post",
    path: "/policies",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: insertSellabilityPolicySchema } },
      },
    },
    responses: {
      201: {
        description: "The created sellability policy",
        content: { "application/json": { schema: z.object({ data: policySchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const getPolicyRoute = createRoute({
    method: "get",
    path: "/policies/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "A sellability policy by id",
        content: { "application/json": { schema: z.object({ data: policySchema }) } },
      },
      404: {
        description: "Sellability policy not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const updatePolicyRoute = createRoute({
    method: "patch",
    path: "/policies/{id}",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateSellabilityPolicySchema } },
      },
    },
    responses: {
      200: {
        description: "The updated sellability policy",
        content: { "application/json": { schema: z.object({ data: policySchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
      404: {
        description: "Sellability policy not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const deletePolicyRoute = createRoute({
    method: "delete",
    path: "/policies/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Sellability policy deleted",
        content: { "application/json": { schema: successSchema } },
      },
      404: {
        description: "Sellability policy not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const policyRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listPoliciesRoute, async (c) =>
      c.json(await service.listPolicies(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createPolicyRoute, async (c) => {
      const row = await service.createPolicy(c.get("db"), c.req.valid("json"))
      if (!row) throw new Error("Failed to create sellability policy")
      return c.json({ data: row }, 201)
    })
    .openapi(getPolicyRoute, async (c) => {
      const row = await service.getPolicyById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(updatePolicyRoute, async (c) => {
      const row = await service.updatePolicy(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(deletePolicyRoute, async (c) => {
      const row = await service.deletePolicy(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability policy not found" }, 404)
      return c.json({ success: true }, 200)
    })

  // ========================================================================
  // Policy results
  // ========================================================================

  const listPolicyResultsRoute = createRoute({
    method: "get",
    path: "/policy-results",
    request: { query: sellabilityPolicyResultListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of sellability policy results",
        content: { "application/json": { schema: listResponseSchema(policyResultSchema) } },
      },
    },
  })

  const createPolicyResultRoute = createRoute({
    method: "post",
    path: "/policy-results",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: insertSellabilityPolicyResultSchema } },
      },
    },
    responses: {
      201: {
        description: "The created sellability policy result",
        content: { "application/json": { schema: z.object({ data: policyResultSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const getPolicyResultRoute = createRoute({
    method: "get",
    path: "/policy-results/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "A sellability policy result by id",
        content: { "application/json": { schema: z.object({ data: policyResultSchema }) } },
      },
      404: {
        description: "Sellability policy result not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const updatePolicyResultRoute = createRoute({
    method: "patch",
    path: "/policy-results/{id}",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateSellabilityPolicyResultSchema } },
      },
    },
    responses: {
      200: {
        description: "The updated sellability policy result",
        content: { "application/json": { schema: z.object({ data: policyResultSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
      404: {
        description: "Sellability policy result not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const deletePolicyResultRoute = createRoute({
    method: "delete",
    path: "/policy-results/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Sellability policy result deleted",
        content: { "application/json": { schema: successSchema } },
      },
      404: {
        description: "Sellability policy result not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const policyResultRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listPolicyResultsRoute, async (c) =>
      c.json(await service.listPolicyResults(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createPolicyResultRoute, async (c) => {
      const row = await service.createPolicyResult(c.get("db"), c.req.valid("json"))
      if (!row) throw new Error("Failed to create sellability policy result")
      return c.json({ data: row }, 201)
    })
    .openapi(getPolicyResultRoute, async (c) => {
      const row = await service.getPolicyResultById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(updatePolicyResultRoute, async (c) => {
      const row = await service.updatePolicyResult(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(deletePolicyResultRoute, async (c) => {
      const row = await service.deletePolicyResult(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability policy result not found" }, 404)
      return c.json({ success: true }, 200)
    })

  // ========================================================================
  // Offer refresh runs
  // ========================================================================

  const listOfferRefreshRunsRoute = createRoute({
    method: "get",
    path: "/offer-refresh-runs",
    request: { query: offerRefreshRunListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of offer refresh runs",
        content: { "application/json": { schema: listResponseSchema(offerRefreshRunSchema) } },
      },
    },
  })

  const createOfferRefreshRunRoute = createRoute({
    method: "post",
    path: "/offer-refresh-runs",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: insertOfferRefreshRunSchema } },
      },
    },
    responses: {
      201: {
        description: "The created offer refresh run",
        content: { "application/json": { schema: z.object({ data: offerRefreshRunSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const getOfferRefreshRunRoute = createRoute({
    method: "get",
    path: "/offer-refresh-runs/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "An offer refresh run by id",
        content: { "application/json": { schema: z.object({ data: offerRefreshRunSchema }) } },
      },
      404: {
        description: "Offer refresh run not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const updateOfferRefreshRunRoute = createRoute({
    method: "patch",
    path: "/offer-refresh-runs/{id}",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateOfferRefreshRunSchema } },
      },
    },
    responses: {
      200: {
        description: "The updated offer refresh run",
        content: { "application/json": { schema: z.object({ data: offerRefreshRunSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
      404: {
        description: "Offer refresh run not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const deleteOfferRefreshRunRoute = createRoute({
    method: "delete",
    path: "/offer-refresh-runs/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Offer refresh run deleted",
        content: { "application/json": { schema: successSchema } },
      },
      404: {
        description: "Offer refresh run not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const offerRefreshRunRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listOfferRefreshRunsRoute, async (c) =>
      c.json(await service.listOfferRefreshRuns(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createOfferRefreshRunRoute, async (c) => {
      const row = await service.createOfferRefreshRun(c.get("db"), c.req.valid("json"))
      if (!row) throw new Error("Failed to create offer refresh run")
      return c.json({ data: row }, 201)
    })
    .openapi(getOfferRefreshRunRoute, async (c) => {
      const row = await service.getOfferRefreshRunById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(updateOfferRefreshRunRoute, async (c) => {
      const row = await service.updateOfferRefreshRun(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(deleteOfferRefreshRunRoute, async (c) => {
      const row = await service.deleteOfferRefreshRun(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Offer refresh run not found" }, 404)
      return c.json({ success: true }, 200)
    })

  // ========================================================================
  // Offer expiration events
  // ========================================================================

  const listOfferExpirationEventsRoute = createRoute({
    method: "get",
    path: "/offer-expiration-events",
    request: { query: offerExpirationEventListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of offer expiration events",
        content: {
          "application/json": { schema: listResponseSchema(offerExpirationEventSchema) },
        },
      },
    },
  })

  const createOfferExpirationEventRoute = createRoute({
    method: "post",
    path: "/offer-expiration-events",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: insertOfferExpirationEventSchema } },
      },
    },
    responses: {
      201: {
        description: "The created offer expiration event",
        content: {
          "application/json": { schema: z.object({ data: offerExpirationEventSchema }) },
        },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const getOfferExpirationEventRoute = createRoute({
    method: "get",
    path: "/offer-expiration-events/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "An offer expiration event by id",
        content: {
          "application/json": { schema: z.object({ data: offerExpirationEventSchema }) },
        },
      },
      404: {
        description: "Offer expiration event not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const updateOfferExpirationEventRoute = createRoute({
    method: "patch",
    path: "/offer-expiration-events/{id}",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateOfferExpirationEventSchema } },
      },
    },
    responses: {
      200: {
        description: "The updated offer expiration event",
        content: {
          "application/json": { schema: z.object({ data: offerExpirationEventSchema }) },
        },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
      404: {
        description: "Offer expiration event not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const deleteOfferExpirationEventRoute = createRoute({
    method: "delete",
    path: "/offer-expiration-events/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Offer expiration event deleted",
        content: { "application/json": { schema: successSchema } },
      },
      404: {
        description: "Offer expiration event not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const offerExpirationEventRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listOfferExpirationEventsRoute, async (c) =>
      c.json(await service.listOfferExpirationEvents(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createOfferExpirationEventRoute, async (c) => {
      const row = await service.createOfferExpirationEvent(c.get("db"), c.req.valid("json"))
      if (!row) throw new Error("Failed to create offer expiration event")
      return c.json({ data: row }, 201)
    })
    .openapi(getOfferExpirationEventRoute, async (c) => {
      const row = await service.getOfferExpirationEventById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(updateOfferExpirationEventRoute, async (c) => {
      const row = await service.updateOfferExpirationEvent(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(deleteOfferExpirationEventRoute, async (c) => {
      const row = await service.deleteOfferExpirationEvent(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Offer expiration event not found" }, 404)
      return c.json({ success: true }, 200)
    })

  // ========================================================================
  // Explanations
  // ========================================================================

  const listExplanationsRoute = createRoute({
    method: "get",
    path: "/explanations",
    request: { query: sellabilityExplanationListQuerySchema },
    responses: {
      200: {
        description: "Paginated list of sellability explanations",
        content: { "application/json": { schema: listResponseSchema(explanationSchema) } },
      },
    },
  })

  const createExplanationRoute = createRoute({
    method: "post",
    path: "/explanations",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: insertSellabilityExplanationSchema } },
      },
    },
    responses: {
      201: {
        description: "The created sellability explanation",
        content: { "application/json": { schema: z.object({ data: explanationSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const getExplanationRoute = createRoute({
    method: "get",
    path: "/explanations/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "A sellability explanation by id",
        content: { "application/json": { schema: z.object({ data: explanationSchema }) } },
      },
      404: {
        description: "Sellability explanation not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const updateExplanationRoute = createRoute({
    method: "patch",
    path: "/explanations/{id}",
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: { "application/json": { schema: updateSellabilityExplanationSchema } },
      },
    },
    responses: {
      200: {
        description: "The updated sellability explanation",
        content: { "application/json": { schema: z.object({ data: explanationSchema }) } },
      },
      400: {
        description: "invalid_request: request body failed validation",
        content: { "application/json": { schema: errorResponseSchema } },
      },
      404: {
        description: "Sellability explanation not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const deleteExplanationRoute = createRoute({
    method: "delete",
    path: "/explanations/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        description: "Sellability explanation deleted",
        content: { "application/json": { schema: successSchema } },
      },
      404: {
        description: "Sellability explanation not found",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    },
  })

  const explanationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listExplanationsRoute, async (c) =>
      c.json(await service.listExplanations(c.get("db"), c.req.valid("query")), 200),
    )
    .openapi(createExplanationRoute, async (c) => {
      const row = await service.createExplanation(c.get("db"), c.req.valid("json"))
      if (!row) throw new Error("Failed to create sellability explanation")
      return c.json({ data: row }, 201)
    })
    .openapi(getExplanationRoute, async (c) => {
      const row = await service.getExplanationById(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(updateExplanationRoute, async (c) => {
      const row = await service.updateExplanation(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ data: row }, 200)
    })
    .openapi(deleteExplanationRoute, async (c) => {
      const row = await service.deleteExplanation(c.get("db"), c.req.valid("param").id)
      if (!row) return c.json({ error: "Sellability explanation not found" }, 404)
      return c.json({ success: true }, 200)
    })

  // Mount each per-resource child sub-chain on the sellability parent.
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .route("/", snapshotRoutes)
    .route("/", policyRoutes)
    .route("/", policyResultRoutes)
    .route("/", offerRefreshRunRoutes)
    .route("/", offerExpirationEventRoutes)
    .route("/", explanationRoutes)
}

export const sellabilityRoutes = createSellabilityRoutes()

export type SellabilityRoutes = typeof sellabilityRoutes
