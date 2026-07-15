/**
 * Policy admin + public routes. The combined `legalApiModule` mounts these
 * under `/v1/admin/legal/policies/*` and `/v1/public/legal/policies/*`.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114).
 * To keep each `.openapi()` chain's type inference modest, both bundles are
 * assembled from per-resource sub-chains (versions, rules, assignments,
 * acceptances, policies-core), each its own small `OpenAPIHono`, composed via
 * `.route("/", subApp)`. Static + nested-resource segments (`/resolve`,
 * `/versions/*`, `/rules/*`, `/assignments`, `/acceptances`) register before the
 * dynamic `/{id}` family so the router matches them first.
 *
 * Request schemas reuse the `./validation` (legal-contracts) schemas the
 * handlers already parse; response schemas are authored here from the row shapes
 * (§17: timestamp / `date` columns serialize to strings over the wire — never
 * `Date`). The `/resolve` and `/{id}/evaluate` legs return computed objects
 * (not rows), so their response schemas are permissive on the nested payload.
 *
 * agent-quality: file-size exception — intentional: a single mounted policy
 * admin surface spanning five resources whose `createRoute` objects co-locate
 * with their per-resource sub-chain handlers (mirrors
 * `distribution/src/suppliers/routes.ts`). See voyant#2114.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { legalTargetKindSchema } from "@voyant-travel/legal-contracts/targets/validation"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { policiesService } from "./service.js"
import {
  evaluateCancellationInputSchema,
  insertPolicyAcceptanceSchema,
  insertPolicyAssignmentSchema,
  insertPolicyRuleSchema,
  insertPolicySchema,
  insertPolicyVersionSchema,
  policyAcceptanceListQuerySchema,
  policyAssignmentListQuerySchema,
  policyListQuerySchema,
  resolvePolicyInputSchema,
  updatePolicyAssignmentSchema,
  updatePolicyRuleSchema,
  updatePolicySchema,
  updatePolicyVersionSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const PUBLIC_LEGAL_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

function cachePublicLegalRead(c: Context) {
  c.header("Cache-Control", PUBLIC_LEGAL_CACHE_CONTROL)
}

// ==========================================================================
// Shared response building blocks
// ==========================================================================

const errorResponseSchema = z.object({ error: z.string() })
const deleteResponseSchema = z.object({ success: z.boolean() })

const idParamSchema = z.object({ id: z.string() })
const versionIdParamSchema = z.object({ versionId: z.string() })
const ruleIdParamSchema = z.object({ ruleId: z.string() })
const slugParamSchema = z.object({ slug: z.string() })

// Open jsonb columns (`metadata`, `conditions`) carry no Drizzle `$type`, so
// the wire contract is an opaque JSON value (mirrors `contracts/routes.ts`).
const jsonValue = z.unknown()

// --- enum value lists mirror the Drizzle pgEnums --------------------------

const policyKindValues = [
  "cancellation",
  "payment",
  "terms_and_conditions",
  "privacy",
  "refund",
  "commission",
  "guarantee",
  "other",
] as const
const policyVersionStatusValues = ["draft", "published", "retired"] as const
const policyRuleTypeValues = [
  "window",
  "percentage",
  "flat_amount",
  "date_range",
  "custom",
] as const
const policyRefundTypeValues = ["cash", "credit", "cash_or_credit", "none"] as const
const policyAssignmentScopeValues = [
  "product",
  "channel",
  "supplier",
  "market",
  "organization",
  "global",
] as const
const policyAcceptanceMethodValues = ["implicit", "explicit_checkbox", "signature"] as const

// --- response row schemas (§17: timestamps / `date` columns → strings) -----

/** Wire shape of a `policies` row (§17 timestamps → strings). */
const policySchema = z.object({
  id: z.string(),
  kind: z.enum(policyKindValues),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  language: z.string(),
  currentVersionId: z.string().nullable(),
  metadata: jsonValue,
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Wire shape of a `policy_versions` row (§17 timestamps → strings). */
const policyVersionSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  version: z.number().int(),
  status: z.enum(policyVersionStatusValues),
  title: z.string(),
  body: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publishedBy: z.string().nullable(),
  retiredAt: z.string().nullable(),
  metadata: jsonValue,
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Wire shape of a `policy_rules` row (`validFrom`/`validTo` are `date`s → strings, §17). */
const policyRuleSchema = z.object({
  id: z.string(),
  policyVersionId: z.string(),
  ruleType: z.enum(policyRuleTypeValues),
  label: z.string().nullable(),
  daysBeforeDeparture: z.number().int().nullable(),
  refundPercent: z.number().int().nullable(),
  refundType: z.enum(policyRefundTypeValues).nullable(),
  flatAmountCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  conditions: jsonValue,
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Wire shape of a `policy_assignments` row (`date`s + timestamps → strings, §17). */
const policyAssignmentSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  scope: z.enum(policyAssignmentScopeValues),
  productId: z.string().nullable(),
  channelId: z.string().nullable(),
  supplierId: z.string().nullable(),
  marketId: z.string().nullable(),
  organizationId: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  priority: z.number().int(),
  metadata: jsonValue,
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Wire shape of a `policy_acceptances` row (§17 timestamps → strings). */
const policyAcceptanceSchema = z.object({
  id: z.string(),
  policyVersionId: z.string(),
  personId: z.string().nullable(),
  bookingId: z.string().nullable(),
  targetKind: legalTargetKindSchema.nullable(),
  targetId: z.string().nullable(),
  targetProvider: z.string().nullable(),
  targetSourceRef: z.string().nullable(),
  legacyTransactionOfferId: z.string().nullable(),
  legacyTransactionOrderId: z.string().nullable(),
  acceptedAt: z.string(),
  acceptedBy: z.string().nullable(),
  method: z.enum(policyAcceptanceMethodValues),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: jsonValue,
  createdAt: z.string(),
})

/**
 * Computed cancellation-evaluation payload (not a row). The `appliedRule` is a
 * projection of a rule (or `null`), so the nested shape is permissive.
 */
const cancellationResultSchema = z.object({
  refundPercent: z.number().int(),
  refundCents: z.number().int(),
  refundType: z.enum(policyRefundTypeValues),
  appliedRule: jsonValue,
})

/**
 * Resolved-policy payload — a winner assignment + policy + (optional) current
 * version and its rules. Computed, so the nested shapes are permissive.
 */
const resolvedPolicySchema = z.object({
  policy: policySchema,
  assignment: policyAssignmentSchema,
  version: policyVersionSchema.nullable(),
  rules: z.array(policyRuleSchema),
})

// ==========================================================================
// Versions (nested under a policy + flat `/versions/*`)
// ==========================================================================

const listVersionsRoute = createRoute({
  method: "get",
  path: "/{id}/versions",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Versions of a policy (newest first)",
      content: { "application/json": { schema: z.object({ data: z.array(policyVersionSchema) }) } },
    },
  },
})

const createVersionRoute = createRoute({
  method: "post",
  path: "/{id}/versions",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertPolicyVersionSchema } },
    },
  },
  responses: {
    201: {
      description: "The created (draft) policy version",
      content: { "application/json": { schema: z.object({ data: policyVersionSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getVersionRoute = createRoute({
  method: "get",
  path: "/versions/{versionId}",
  request: { params: versionIdParamSchema },
  responses: {
    200: {
      description: "A policy version by id",
      content: { "application/json": { schema: z.object({ data: policyVersionSchema }) } },
    },
    404: {
      description: "Policy version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateVersionRoute = createRoute({
  method: "patch",
  path: "/versions/{versionId}",
  request: {
    params: versionIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePolicyVersionSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated draft policy version",
      content: { "application/json": { schema: z.object({ data: policyVersionSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy version not found or not a draft",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const publishVersionRoute = createRoute({
  method: "post",
  path: "/versions/{versionId}/publish",
  request: { params: versionIdParamSchema },
  responses: {
    200: {
      description: "The published policy version",
      content: { "application/json": { schema: z.object({ data: policyVersionSchema }) } },
    },
    404: {
      description: "Policy version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Only draft versions can be published",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const retireVersionRoute = createRoute({
  method: "post",
  path: "/versions/{versionId}/retire",
  request: { params: versionIdParamSchema },
  responses: {
    200: {
      description: "The retired policy version",
      content: { "application/json": { schema: z.object({ data: policyVersionSchema }) } },
    },
    404: {
      description: "Policy version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const versionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listVersionsRoute, async (c) =>
    c.json(
      { data: await policiesService.listPolicyVersions(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(createVersionRoute, async (c) => {
    const version = await policiesService.createPolicyVersion(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return version ? c.json({ data: version }, 201) : c.json({ error: "Policy not found" }, 404)
  })
  .openapi(getVersionRoute, async (c) => {
    const row = await policiesService.getPolicyVersionById(
      c.get("db"),
      c.req.valid("param").versionId,
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy version not found" }, 404)
  })
  .openapi(updateVersionRoute, async (c) => {
    const row = await policiesService.updatePolicyVersion(
      c.get("db"),
      c.req.valid("param").versionId,
      c.req.valid("json"),
    )
    return row
      ? c.json({ data: row }, 200)
      : c.json({ error: "Policy version not found or not a draft" }, 404)
  })
  .openapi(publishVersionRoute, async (c) => {
    const result = await policiesService.publishPolicyVersion(
      c.get("db"),
      c.req.valid("param").versionId,
    )
    if (result.status === "not_found") return c.json({ error: "Policy version not found" }, 404)
    if (result.status === "not_draft") {
      return c.json({ error: "Only draft versions can be published" }, 409)
    }
    return c.json({ data: result.version! }, 200)
  })
  .openapi(retireVersionRoute, async (c) => {
    const row = await policiesService.retirePolicyVersion(
      c.get("db"),
      c.req.valid("param").versionId,
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy version not found" }, 404)
  })

// ==========================================================================
// Rules (nested under a version + flat `/rules/*`)
// ==========================================================================

const listRulesRoute = createRoute({
  method: "get",
  path: "/versions/{versionId}/rules",
  request: { params: versionIdParamSchema },
  responses: {
    200: {
      description: "Rules of a policy version (ordered by sort order)",
      content: { "application/json": { schema: z.object({ data: z.array(policyRuleSchema) }) } },
    },
  },
})

const createRuleRoute = createRoute({
  method: "post",
  path: "/versions/{versionId}/rules",
  request: {
    params: versionIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertPolicyRuleSchema } },
    },
  },
  responses: {
    201: {
      description: "The created policy rule",
      content: { "application/json": { schema: z.object({ data: policyRuleSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateRuleRoute = createRoute({
  method: "patch",
  path: "/rules/{ruleId}",
  request: {
    params: ruleIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePolicyRuleSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated policy rule",
      content: { "application/json": { schema: z.object({ data: policyRuleSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteRuleRoute = createRoute({
  method: "delete",
  path: "/rules/{ruleId}",
  request: { params: ruleIdParamSchema },
  responses: {
    200: {
      description: "Policy rule deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Policy rule not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const ruleRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listRulesRoute, async (c) =>
    c.json(
      { data: await policiesService.listPolicyRules(c.get("db"), c.req.valid("param").versionId) },
      200,
    ),
  )
  .openapi(createRuleRoute, async (c) => {
    const row = await policiesService.createPolicyRule(
      c.get("db"),
      c.req.valid("param").versionId,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Policy version not found" }, 404)
  })
  .openapi(updateRuleRoute, async (c) => {
    const row = await policiesService.updatePolicyRule(
      c.get("db"),
      c.req.valid("param").ruleId,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy rule not found" }, 404)
  })
  .openapi(deleteRuleRoute, async (c) => {
    const row = await policiesService.deletePolicyRule(c.get("db"), c.req.valid("param").ruleId)
    return row ? c.json({ success: true }, 200) : c.json({ error: "Policy rule not found" }, 404)
  })

// ==========================================================================
// Assignments
// ==========================================================================

const listAssignmentsRoute = createRoute({
  method: "get",
  path: "/assignments",
  request: { query: policyAssignmentListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of policy assignments",
      content: { "application/json": { schema: listResponseSchema(policyAssignmentSchema) } },
    },
  },
})

const createAssignmentRoute = createRoute({
  method: "post",
  path: "/assignments",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPolicyAssignmentSchema } },
    },
  },
  responses: {
    201: {
      description: "The created policy assignment",
      content: { "application/json": { schema: z.object({ data: policyAssignmentSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateAssignmentRoute = createRoute({
  method: "patch",
  path: "/assignments/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updatePolicyAssignmentSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated policy assignment",
      content: { "application/json": { schema: z.object({ data: policyAssignmentSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy assignment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteAssignmentRoute = createRoute({
  method: "delete",
  path: "/assignments/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Policy assignment deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Policy assignment not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const assignmentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listAssignmentsRoute, async (c) =>
    c.json(await policiesService.listPolicyAssignments(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createAssignmentRoute, async (c) => {
    const row = await policiesService.createPolicyAssignment(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(updateAssignmentRoute, async (c) => {
    const row = await policiesService.updatePolicyAssignment(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy assignment not found" }, 404)
  })
  .openapi(deleteAssignmentRoute, async (c) => {
    const row = await policiesService.deletePolicyAssignment(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true }, 200)
      : c.json({ error: "Policy assignment not found" }, 404)
  })

// ==========================================================================
// Acceptances
// ==========================================================================

const listAcceptancesRoute = createRoute({
  method: "get",
  path: "/acceptances",
  request: { query: policyAcceptanceListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of policy acceptances",
      content: { "application/json": { schema: listResponseSchema(policyAcceptanceSchema) } },
    },
  },
})

const createAcceptanceRoute = createRoute({
  method: "post",
  path: "/acceptances",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: insertPolicyAcceptanceSchema } },
    },
  },
  responses: {
    201: {
      description: "The recorded policy acceptance",
      content: { "application/json": { schema: z.object({ data: policyAcceptanceSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const acceptanceRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listAcceptancesRoute, async (c) =>
    c.json(await policiesService.listPolicyAcceptances(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createAcceptanceRoute, async (c) => {
    const row = await policiesService.recordPolicyAcceptance(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })

// ==========================================================================
// Policies — CRUD + resolve + evaluate
// ==========================================================================

const listPoliciesRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: policyListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of policies",
      content: { "application/json": { schema: listResponseSchema(policySchema) } },
    },
  },
})

const createPolicyRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: { required: true, content: { "application/json": { schema: insertPolicySchema } } },
  },
  responses: {
    201: {
      description: "The created policy",
      content: { "application/json": { schema: z.object({ data: policySchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const resolvePolicyRoute = createRoute({
  method: "get",
  path: "/resolve",
  request: { query: resolvePolicyInputSchema },
  responses: {
    200: {
      description:
        "The resolved policy for the given scope, or `{ data: null }` when no " +
        "assignment matches",
      content: {
        "application/json": {
          schema: z.object({ data: resolvedPolicySchema.nullable() }),
        },
      },
    },
  },
})

const getPolicyRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A policy by id",
      content: { "application/json": { schema: z.object({ data: policySchema }) } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updatePolicyRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: idParamSchema,
    body: { required: true, content: { "application/json": { schema: updatePolicySchema } } },
  },
  responses: {
    200: {
      description: "The updated policy",
      content: { "application/json": { schema: z.object({ data: policySchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deletePolicyRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Policy deleted",
      content: { "application/json": { schema: deleteResponseSchema } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Policy has recorded acceptances and cannot be deleted",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const evaluatePolicyRoute = createRoute({
  method: "post",
  path: "/{id}/evaluate",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: evaluateCancellationInputSchema } },
    },
  },
  responses: {
    200: {
      description: "The cancellation evaluation for the policy's current version",
      content: { "application/json": { schema: z.object({ data: cancellationResultSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Policy or current version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const policyRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  // GET /resolve before /{id} so the matcher doesn't swallow it.
  .openapi(resolvePolicyRoute, async (c) => {
    const result = await policiesService.resolvePolicy(c.get("db"), c.req.valid("query"))
    return c.json({ data: result ?? null }, 200)
  })
  .openapi(listPoliciesRoute, async (c) =>
    c.json(await policiesService.listPolicies(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createPolicyRoute, async (c) => {
    const row = await policiesService.createPolicy(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getPolicyRoute, async (c) => {
    const row = await policiesService.getPolicyById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy not found" }, 404)
  })
  .openapi(updatePolicyRoute, async (c) => {
    const row = await policiesService.updatePolicy(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Policy not found" }, 404)
  })
  .openapi(deletePolicyRoute, async (c) => {
    const result = await policiesService.deletePolicy(c.get("db"), c.req.valid("param").id)
    if (result.status === "deleted") return c.json({ success: true }, 200)
    if (result.status === "has_acceptances") {
      return c.json({ error: "Policy has recorded acceptances and cannot be deleted" }, 409)
    }
    return c.json({ error: "Policy not found" }, 404)
  })
  .openapi(evaluatePolicyRoute, async (c) => {
    const result = await policiesService.evaluateCancellation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return result
      ? c.json({ data: result }, 200)
      : c.json({ error: "Policy or current version not found" }, 404)
  })

// ==========================================================================
// Composition — static + nested-resource sub-chains register before the
// dynamic `/{id}` family (policyRoutes) so the router matches them first.
// ==========================================================================

export const policiesAdminRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", versionRoutes)
  .route("/", ruleRoutes)
  .route("/", assignmentRoutes)
  .route("/", acceptanceRoutes)
  .route("/", policyRoutes)

export type PoliciesAdminRoutes = typeof policiesAdminRoutes

// ==========================================================================
// Policies public routes — `/v1/public/legal/policies/*`
// Customer-facing: fetch current published version by slug + record acceptance
// ==========================================================================

const getPublicPolicyRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: { params: slugParamSchema },
  responses: {
    200: {
      description: "A policy and its current published version, by slug",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({ policy: policySchema, version: policyVersionSchema }),
          }),
        },
      },
    },
    404: {
      description: "Policy not found or has no published version",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const acceptPublicPolicyRoute = createRoute({
  method: "post",
  path: "/{id}/accept",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertPolicyAcceptanceSchema } },
    },
  },
  responses: {
    201: {
      description: "The recorded policy acceptance",
      content: { "application/json": { schema: z.object({ data: policyAcceptanceSchema }) } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const policiesPublicRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(getPublicPolicyRoute, async (c) => {
    const policy = await policiesService.getPolicyBySlug(c.get("db"), c.req.valid("param").slug)
    if (!policy) return c.json({ error: "Policy not found" }, 404)
    if (!policy.currentVersionId) {
      return c.json({ error: "Policy has no published version" }, 404)
    }
    const version = await policiesService.getPolicyVersionById(c.get("db"), policy.currentVersionId)
    if (version?.status !== "published") {
      return c.json({ error: "Policy has no published version" }, 404)
    }
    cachePublicLegalRead(c)
    return c.json({ data: { policy, version } }, 200)
  })
  .openapi(acceptPublicPolicyRoute, async (c) => {
    const row = await policiesService.recordPolicyAcceptance(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })

export type PoliciesPublicRoutes = typeof policiesPublicRoutes
