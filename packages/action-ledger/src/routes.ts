/**
 * Admin routes for the action ledger — mounted by the operator starter under
 * `/v1/admin/action-ledger` (staff-actor-gated by the parent app's middleware
 * chain). Covers four resource sub-chains (entries, approvals, delegations,
 * relay-outbox) plus a root entries alias.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208). Request schemas reuse the existing `route-schemas.ts` schemas
 * the handlers already parse; response row schemas are authored from the
 * Drizzle `$inferSelect` shapes (§17: timestamp columns serialize to ISO
 * strings over the wire). Arbitrary jsonb ledger details (e.g. the sensitive
 * read `disclosedFieldSet`) are modelled with concrete shapes; nothing here is
 * a bare `any`.
 *
 * agent-quality: file-size exception — intentional: the authored response row
 * schemas (entries/approvals/delegations/relay-outbox), their `createRoute`
 * objects, and the four per-resource sub-chains co-locate with their handlers
 * per the established admin route pattern (mirrors `commerce/pricing/
 * routes-core.ts`). Splitting per resource would fragment the single mounted
 * instance and its shared serializers without aiding review. See voyant#2114 /
 * voyant#2208.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Module } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { openApiValidationHook, stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"
import {
  actionApprovalListQuerySchema,
  actionDelegationListQuerySchema,
  actionLedgerEntryListQuerySchema,
  actionLedgerRelayOutboxListQuerySchema,
  decideActionApprovalBodySchema,
  recordActionLedgerReversalBodySchema,
  requestActionApprovalBodySchema,
} from "./route-schemas.js"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "./schema.js"
import {
  ActionApprovalDecisionConflictError,
  ActionLedgerReversalTargetError,
  actionLedgerService,
  type GetActionApprovalResult,
  type GetActionDelegationResult,
  type GetActionLedgerEntryResult,
} from "./service.js"

type Env = {
  Variables: {
    db: AnyDrizzleDb
  }
}

export type ActionLedgerEntryResponse = Omit<ActionLedgerEntry, "occurredAt" | "createdAt"> & {
  occurredAt: string
  createdAt: string
}

export interface ActionLedgerListResponse {
  data: ActionLedgerEntryResponse[]
  pageInfo: {
    nextCursor: {
      occurredAt: string
      id: string
    } | null
  }
}

export type ActionLedgerEntryDetailResponse = ActionLedgerEntryResponse & {
  mutationDetail: ActionMutationDetail | null
  sensitiveReadDetail: ActionSensitiveReadDetail | null
  payloads: ActionLedgerPayloadResponse[]
  relayOutbox: ActionLedgerRelayOutboxResponse[]
}

export interface ActionLedgerGetResponse {
  data: ActionLedgerEntryDetailResponse
}

export interface ActionLedgerRelayOutboxListResponse {
  data: ActionLedgerRelayOutboxResponse[]
  pageInfo: {
    nextCursor: {
      createdAt: string
      id: string
    } | null
  }
}

export interface ActionApprovalListResponse {
  data: ActionApprovalResponse[]
  pageInfo: {
    nextCursor: {
      createdAt: string
      id: string
    } | null
  }
}

export interface ActionApprovalGetResponse {
  data: ActionApprovalDetailResponse
}

export interface ActionApprovalRequestResponse {
  data: {
    requestedAction: ActionLedgerEntryResponse
    approval: ActionApprovalResponse
    replayed: boolean
  }
}

export interface ActionApprovalDecisionResponse {
  data: {
    approval: ActionApprovalResponse
    decisionAction: ActionLedgerEntryResponse
  }
}

export interface ActionLedgerReversalResponse {
  data: {
    originalAction: ActionLedgerEntryResponse
    reversalAction: ActionLedgerEntryResponse
    replayed: boolean
  }
}

export interface ActionDelegationListResponse {
  data: ActionDelegationResponse[]
  pageInfo: {
    nextCursor: {
      createdAt: string
      id: string
    } | null
  }
}

export interface ActionDelegationGetResponse {
  data: ActionDelegationResponse
}

export type ActionLedgerPayloadResponse = Omit<ActionLedgerPayload, "createdAt" | "expiresAt"> & {
  createdAt: string
  expiresAt: string | null
}

export type ActionLedgerRelayOutboxResponse = Omit<
  ActionLedgerRelayOutbox,
  "createdAt" | "nextRetryAt" | "processedAt"
> & {
  createdAt: string
  nextRetryAt: string | null
  processedAt: string | null
}

export type ActionApprovalResponse = Omit<
  ActionApproval,
  "createdAt" | "decidedAt" | "expiresAt"
> & {
  createdAt: string
  decidedAt: string | null
  expiresAt: string | null
}

export type ActionApprovalDetailResponse = ActionApprovalResponse & {
  requestedAction: ActionLedgerEntryDetailResponse | null
}

export type ActionDelegationResponse = Omit<ActionDelegation, "createdAt" | "expiresAt"> & {
  createdAt: string
  expiresAt: string | null
}

function serializeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger entry timestamp must be a valid date")
  }
  return date.toISOString()
}

function serializeNullableDate(value: Date | string | null): string | null {
  if (value === null) return null
  return serializeDate(value)
}

function serializeActionLedgerEntry(entry: ActionLedgerEntry): ActionLedgerEntryResponse {
  return {
    ...entry,
    occurredAt: serializeDate(entry.occurredAt),
    createdAt: serializeDate(entry.createdAt),
  }
}

function serializeActionLedgerPayload(payload: ActionLedgerPayload): ActionLedgerPayloadResponse {
  return {
    ...payload,
    createdAt: serializeDate(payload.createdAt),
    expiresAt: serializeNullableDate(payload.expiresAt),
  }
}

function serializeActionLedgerRelayOutbox(
  row: ActionLedgerRelayOutbox,
): ActionLedgerRelayOutboxResponse {
  return {
    ...row,
    createdAt: serializeDate(row.createdAt),
    nextRetryAt: serializeNullableDate(row.nextRetryAt),
    processedAt: serializeNullableDate(row.processedAt),
  }
}

function serializeActionApproval(row: ActionApproval): ActionApprovalResponse {
  return {
    ...row,
    createdAt: serializeDate(row.createdAt),
    decidedAt: serializeNullableDate(row.decidedAt),
    expiresAt: serializeNullableDate(row.expiresAt),
  }
}

function serializeActionApprovalDetail(
  result: GetActionApprovalResult,
): ActionApprovalDetailResponse {
  return {
    ...serializeActionApproval(result.approval),
    requestedAction: result.requestedAction
      ? serializeActionLedgerEntryDetail(result.requestedAction)
      : null,
  }
}

function serializeActionDelegation(row: ActionDelegation): ActionDelegationResponse {
  return {
    ...row,
    createdAt: serializeDate(row.createdAt),
    expiresAt: serializeNullableDate(row.expiresAt),
  }
}

function serializeActionDelegationDetail(
  result: GetActionDelegationResult,
): ActionDelegationResponse {
  return serializeActionDelegation(result.delegation)
}

function serializeActionLedgerEntryDetail(
  result: GetActionLedgerEntryResult,
): ActionLedgerEntryDetailResponse {
  return {
    ...serializeActionLedgerEntry(result.entry),
    mutationDetail: result.mutationDetail,
    sensitiveReadDetail: result.sensitiveReadDetail,
    payloads: result.payloads.map(serializeActionLedgerPayload),
    relayOutbox: result.relayOutbox.map(serializeActionLedgerRelayOutbox),
  }
}

// --- OpenAPI response/error schemas ---------------------------------------
// Authored from the Drizzle `$inferSelect` shapes; §17: timestamp columns are
// ISO strings on the wire.

const isoTimestamp = z.string()
const errorResponseSchema = z.object({ error: z.string() })

const principalTypeSchema = z.enum(["user", "api_key", "agent", "workflow", "system"])
const riskSchema = z.enum(["low", "medium", "high", "critical"])
const actionKindSchema = z.enum([
  "read",
  "create",
  "update",
  "delete",
  "execute",
  "approve",
  "reject",
  "reverse",
  "compensate",
  "duplicate",
])
const actionStatusSchema = z.enum([
  "requested",
  "awaiting_approval",
  "approved",
  "denied",
  "succeeded",
  "failed",
  "reversed",
  "compensated",
  "expired",
  "cancelled",
  "superseded",
])
const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
])
const relayStatusSchema = z.enum(["pending", "processing", "succeeded", "failed", "dead_letter"])
const redactionStatusSchema = z.enum(["none", "redacted", "tombstoned", "crypto_shredded"])
const reversalKindSchema = z.enum(["none", "revert", "compensate", "domain_command"])
const reversalStateSchema = z.enum([
  "not_reversible",
  "available",
  "requested",
  "running",
  "completed",
  "failed",
  "expired",
])
const reversalOutcomeSchema = z.enum(["full", "partial", "failed"])

const actionLedgerEntrySchema = z.object({
  id: z.string(),
  occurredAt: isoTimestamp,
  actionName: z.string(),
  actionVersion: z.string(),
  actionKind: actionKindSchema,
  status: actionStatusSchema,
  evaluatedRisk: riskSchema,
  actorType: z.string().nullable(),
  principalType: principalTypeSchema,
  principalId: z.string(),
  principalSubtype: z.string().nullable(),
  sessionId: z.string().nullable(),
  apiTokenId: z.string().nullable(),
  internalRequest: z.boolean(),
  delegatedByPrincipalType: principalTypeSchema.nullable(),
  delegatedByPrincipalId: z.string().nullable(),
  delegationId: z.string().nullable(),
  callerType: z.string().nullable(),
  organizationId: z.string().nullable(),
  routeOrToolName: z.string().nullable(),
  workflowRunId: z.string().nullable(),
  workflowStepId: z.string().nullable(),
  correlationId: z.string().nullable(),
  causationActionId: z.string().nullable(),
  idempotencyScope: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  idempotencyFingerprint: z.string().nullable(),
  targetType: z.string(),
  targetId: z.string(),
  capabilityId: z.string().nullable(),
  capabilityVersion: z.string().nullable(),
  authorizationSource: z.string().nullable(),
  approvalId: z.string().nullable(),
  amendsActionId: z.string().nullable(),
  createdAt: isoTimestamp,
})

const actionMutationDetailSchema = z.object({
  actionId: z.string(),
  commandInputRef: z.string().nullable(),
  commandResultRef: z.string().nullable(),
  summary: z.string().nullable(),
  reversalKind: reversalKindSchema,
  reversalCommandId: z.string().nullable(),
  reversalCommandVersion: z.string().nullable(),
  reversalArgsRef: z.string().nullable(),
  reversalStateProjection: reversalStateSchema.nullable(),
  reversalOutcomeProjection: reversalOutcomeSchema.nullable(),
  reversesActionId: z.string().nullable(),
  reversedByActionIdProjection: z.string().nullable(),
})

const actionSensitiveReadDetailSchema = z.object({
  actionId: z.string(),
  reasonCode: z.string().nullable(),
  disclosedFieldSet: z.array(z.string()).nullable(),
  disclosureSummary: z.string().nullable(),
  decisionPolicy: z.string().nullable(),
})

const actionLedgerPayloadSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  payloadKind: z.string(),
  schemaTag: z.string(),
  redactionStatus: redactionStatusSchema,
  retentionPolicy: z.string(),
  storageRef: z.string(),
  hash: z.string().nullable(),
  createdAt: isoTimestamp,
  expiresAt: isoTimestamp.nullable(),
})

const actionLedgerRelayOutboxSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  organizationId: z.string().nullable(),
  relayStatus: relayStatusSchema,
  payloadRef: z.string().nullable(),
  attemptCount: z.number().int(),
  nextRetryAt: isoTimestamp.nullable(),
  lastError: z.string().nullable(),
  createdAt: isoTimestamp,
  processedAt: isoTimestamp.nullable(),
})

const actionLedgerEntryDetailSchema = actionLedgerEntrySchema.extend({
  mutationDetail: actionMutationDetailSchema.nullable(),
  sensitiveReadDetail: actionSensitiveReadDetailSchema.nullable(),
  payloads: z.array(actionLedgerPayloadSchema),
  relayOutbox: z.array(actionLedgerRelayOutboxSchema),
})

const actionApprovalSchema = z.object({
  id: z.string(),
  requestedActionId: z.string(),
  status: approvalStatusSchema,
  requestedByPrincipalId: z.string().nullable(),
  assignedToPrincipalId: z.string().nullable(),
  decidedByPrincipalId: z.string().nullable(),
  delegatedFromPrincipalId: z.string().nullable(),
  policyName: z.string(),
  policyVersion: z.string(),
  targetSnapshotRef: z.string().nullable(),
  riskSnapshot: riskSchema,
  reasonCode: z.string().nullable(),
  expiresAt: isoTimestamp.nullable(),
  decidedAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
})

const actionApprovalDetailSchema = actionApprovalSchema.extend({
  requestedAction: actionLedgerEntryDetailSchema.nullable(),
})

const actionDelegationSchema = z.object({
  id: z.string(),
  rootPrincipalType: principalTypeSchema,
  rootPrincipalId: z.string(),
  parentPrincipalType: principalTypeSchema,
  parentPrincipalId: z.string(),
  childPrincipalType: principalTypeSchema,
  childPrincipalId: z.string(),
  grantSource: z.string(),
  capabilityScopeRef: z.string().nullable(),
  budgetScopeRef: z.string().nullable(),
  expiresAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
})

const entryCursorSchema = z.object({ occurredAt: isoTimestamp, id: z.string() }).nullable()
const createdAtCursorSchema = z.object({ createdAt: isoTimestamp, id: z.string() }).nullable()

const actionLedgerListResponseSchema = z.object({
  data: z.array(actionLedgerEntrySchema),
  pageInfo: z.object({ nextCursor: entryCursorSchema }),
})

const relayOutboxListResponseSchema = z.object({
  data: z.array(actionLedgerRelayOutboxSchema),
  pageInfo: z.object({ nextCursor: createdAtCursorSchema }),
})

const approvalListResponseSchema = z.object({
  data: z.array(actionApprovalSchema),
  pageInfo: z.object({ nextCursor: createdAtCursorSchema }),
})

const delegationListResponseSchema = z.object({
  data: z.array(actionDelegationSchema),
  pageInfo: z.object({ nextCursor: createdAtCursorSchema }),
})

const idParamSchema = z.object({ id: z.string() })

// --- entries sub-chain ----------------------------------------------------

const listEntriesRoute = createRoute({
  method: "get",
  path: "/entries",
  request: { query: actionLedgerEntryListQuerySchema },
  responses: {
    200: {
      description: "Paginated action ledger entries (cursor pagination)",
      content: { "application/json": { schema: actionLedgerListResponseSchema } },
    },
    400: {
      description:
        "invalid_request — `cursorOccurredAt` and `cursorId` must be provided together; `targetId` and `targetIds` are mutually exclusive",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const recordReversalRoute = createRoute({
  method: "post",
  path: "/entries/{id}/reversals",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description:
        "Reversal action to append against the original ledger entry, plus an optional reversal-state projection.",
      content: { "application/json": { schema: recordActionLedgerReversalBodySchema } },
    },
  },
  responses: {
    200: {
      description: "The original and appended reversal action",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              originalAction: actionLedgerEntrySchema,
              reversalAction: actionLedgerEntrySchema,
              replayed: z.boolean(),
            }),
          }),
        },
      },
    },
    400: {
      description: "invalid_request — request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Action ledger entry not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Action ledger entry cannot be reversed",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            reason: z.enum(["missing_mutation_detail", "not_reversible"]),
          }),
        },
      },
    },
  },
})

const getEntryRoute = createRoute({
  method: "get",
  path: "/entries/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description:
        "An action ledger entry with mutation/sensitive details, payloads, and relay rows",
      content: {
        "application/json": { schema: z.object({ data: actionLedgerEntryDetailSchema }) },
      },
    },
    404: {
      description: "Action ledger entry not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const entriesRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listEntriesRoute, async (c) => {
    const result = await actionLedgerService.listEntries(c.get("db"), c.req.valid("query"))
    return c.json(
      {
        data: result.entries.map(serializeActionLedgerEntry),
        pageInfo: { nextCursor: result.nextCursor },
      } satisfies ActionLedgerListResponse,
      200,
    )
  })
  .openapi(recordReversalRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")

    try {
      const result = await actionLedgerService.recordReversal(c.get("db"), {
        originalActionId: id,
        reversalAction: {
          ...body.reversalAction,
          mutationDetail: body.reversalAction.mutationDetail
            ? {
                ...body.reversalAction.mutationDetail,
                reversalStateProjection: null,
                reversalOutcomeProjection: null,
                reversedByActionIdProjection: null,
              }
            : undefined,
        },
        projection: body.projection,
      })

      if (!result) {
        return c.json({ error: "Action ledger entry not found" }, 404)
      }

      return c.json(
        {
          data: {
            originalAction: serializeActionLedgerEntry(result.originalAction),
            reversalAction: serializeActionLedgerEntry(result.reversalAction),
            replayed: result.replayed,
          },
        } satisfies ActionLedgerReversalResponse,
        200,
      )
    } catch (error) {
      if (error instanceof ActionLedgerReversalTargetError) {
        return c.json(
          {
            error: "Action ledger entry cannot be reversed",
            reason: error.reason,
          },
          409,
        )
      }
      throw error
    }
  })
  .openapi(getEntryRoute, async (c) => {
    const result = await actionLedgerService.getEntry(c.get("db"), c.req.valid("param").id)
    if (!result) {
      return c.json({ error: "Action ledger entry not found" }, 404)
    }
    return c.json(
      { data: serializeActionLedgerEntryDetail(result) } satisfies ActionLedgerGetResponse,
      200,
    )
  })

// --- approvals sub-chain --------------------------------------------------

const listApprovalsRoute = createRoute({
  method: "get",
  path: "/approvals",
  request: { query: actionApprovalListQuerySchema },
  responses: {
    200: {
      description: "Paginated action approvals (cursor pagination)",
      content: { "application/json": { schema: approvalListResponseSchema } },
    },
    400: {
      description: "invalid_request — `cursorCreatedAt` and `cursorId` must be provided together",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const requestApprovalRoute = createRoute({
  method: "post",
  path: "/approvals/request",
  request: {
    body: {
      required: true,
      description:
        "The requested action plus the approval policy snapshot. Replays the existing approval when the requested action's idempotency key already exists.",
      content: { "application/json": { schema: requestActionApprovalBodySchema } },
    },
  },
  responses: {
    201: {
      description: "The requested action and the created (or replayed) approval",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              requestedAction: actionLedgerEntrySchema,
              approval: actionApprovalSchema,
              replayed: z.boolean(),
            }),
          }),
        },
      },
    },
    400: {
      description: "invalid_request — request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getApprovalRoute = createRoute({
  method: "get",
  path: "/approvals/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An action approval with its requested action detail",
      content: { "application/json": { schema: z.object({ data: actionApprovalDetailSchema }) } },
    },
    404: {
      description: "Action approval not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const decideApprovalRoute = createRoute({
  method: "post",
  path: "/approvals/{id}/decide",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      description:
        "The decision (status + decider) plus the decision action to append. Conflicts when the approval has already been decided.",
      content: { "application/json": { schema: decideActionApprovalBodySchema } },
    },
  },
  responses: {
    200: {
      description: "The decided approval and the appended decision action",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              approval: actionApprovalSchema,
              decisionAction: actionLedgerEntrySchema,
            }),
          }),
        },
      },
    },
    400: {
      description: "invalid_request — request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Action approval not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Action approval has already been decided",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            approvalId: z.string(),
            currentStatus: approvalStatusSchema,
          }),
        },
      },
    },
  },
})

const approvalsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listApprovalsRoute, async (c) => {
    const result = await actionLedgerService.listApprovals(c.get("db"), c.req.valid("query"))
    return c.json(
      {
        data: result.approvals.map(serializeActionApproval),
        pageInfo: { nextCursor: result.nextCursor },
      } satisfies ActionApprovalListResponse,
      200,
    )
  })
  .openapi(requestApprovalRoute, async (c) => {
    const result = await actionLedgerService.requestApproval(c.get("db"), c.req.valid("json"))
    return c.json(
      {
        data: {
          requestedAction: serializeActionLedgerEntry(result.requestedAction),
          approval: serializeActionApproval(result.approval),
          replayed: result.replayed,
        },
      } satisfies ActionApprovalRequestResponse,
      201,
    )
  })
  .openapi(getApprovalRoute, async (c) => {
    const result = await actionLedgerService.getApproval(c.get("db"), c.req.valid("param").id)
    if (!result) {
      return c.json({ error: "Action approval not found" }, 404)
    }
    return c.json(
      { data: serializeActionApprovalDetail(result) } satisfies ActionApprovalGetResponse,
      200,
    )
  })
  .openapi(decideApprovalRoute, async (c) => {
    const id = c.req.valid("param").id
    const body = c.req.valid("json")

    try {
      const result = await actionLedgerService.decideApproval(c.get("db"), { id, ...body })

      if (!result) {
        return c.json({ error: "Action approval not found" }, 404)
      }

      return c.json(
        {
          data: {
            approval: serializeActionApproval(result.approval),
            decisionAction: serializeActionLedgerEntry(result.decisionAction),
          },
        } satisfies ActionApprovalDecisionResponse,
        200,
      )
    } catch (error) {
      if (error instanceof ActionApprovalDecisionConflictError) {
        return c.json(
          {
            error: error.message,
            approvalId: error.approvalId,
            currentStatus: error.currentStatus,
          },
          409,
        )
      }
      throw error
    }
  })

// --- delegations sub-chain ------------------------------------------------

const listDelegationsRoute = createRoute({
  method: "get",
  path: "/delegations",
  request: { query: actionDelegationListQuerySchema },
  responses: {
    200: {
      description: "Paginated action delegations (cursor pagination)",
      content: { "application/json": { schema: delegationListResponseSchema } },
    },
    400: {
      description: "invalid_request — `cursorCreatedAt` and `cursorId` must be provided together",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const getDelegationRoute = createRoute({
  method: "get",
  path: "/delegations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An action delegation by id",
      content: { "application/json": { schema: z.object({ data: actionDelegationSchema }) } },
    },
    404: {
      description: "Action delegation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const delegationsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDelegationsRoute, async (c) => {
    const result = await actionLedgerService.listDelegations(c.get("db"), c.req.valid("query"))
    return c.json(
      {
        data: result.delegations.map(serializeActionDelegation),
        pageInfo: { nextCursor: result.nextCursor },
      } satisfies ActionDelegationListResponse,
      200,
    )
  })
  .openapi(getDelegationRoute, async (c) => {
    const result = await actionLedgerService.getDelegation(c.get("db"), c.req.valid("param").id)
    if (!result) {
      return c.json({ error: "Action delegation not found" }, 404)
    }
    return c.json(
      { data: serializeActionDelegationDetail(result) } satisfies ActionDelegationGetResponse,
      200,
    )
  })

// --- relay-outbox sub-chain -----------------------------------------------

const listRelayOutboxRoute = createRoute({
  method: "get",
  path: "/relay-outbox",
  request: { query: actionLedgerRelayOutboxListQuerySchema },
  responses: {
    200: {
      description: "Paginated relay outbox rows (cursor pagination)",
      content: { "application/json": { schema: relayOutboxListResponseSchema } },
    },
    400: {
      description: "invalid_request — `cursorCreatedAt` and `cursorId` must be provided together",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const relayOutboxRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook }).openapi(
  listRelayOutboxRoute,
  async (c) => {
    const result = await actionLedgerService.listRelayOutbox(c.get("db"), c.req.valid("query"))
    return c.json(
      {
        data: result.rows.map(serializeActionLedgerRelayOutbox),
        pageInfo: { nextCursor: result.nextCursor },
      } satisfies ActionLedgerRelayOutboxListResponse,
      200,
    )
  },
)

// --- root entries alias ---------------------------------------------------

const listEntriesRootRoute = createRoute({
  method: "get",
  path: "/",
  request: { query: actionLedgerEntryListQuerySchema },
  responses: {
    200: {
      description: "Paginated action ledger entries (alias for GET /entries)",
      content: { "application/json": { schema: actionLedgerListResponseSchema } },
    },
    400: {
      description:
        "invalid_request — `cursorOccurredAt` and `cursorId` must be provided together; `targetId` and `targetIds` are mutually exclusive",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const actionLedgerAdminRoutes = stampOpenApiRegistryApiId(
  new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(listEntriesRootRoute, async (c) => {
      const result = await actionLedgerService.listEntries(c.get("db"), c.req.valid("query"))
      return c.json(
        {
          data: result.entries.map(serializeActionLedgerEntry),
          pageInfo: { nextCursor: result.nextCursor },
        } satisfies ActionLedgerListResponse,
        200,
      )
    })
    .route("/", entriesRoutes)
    .route("/", approvalsRoutes)
    .route("/", delegationsRoutes)
    .route("/", relayOutboxRoutes),
  "@voyant-travel/action-ledger#api.admin",
)

export type ActionLedgerAdminRoutes = typeof actionLedgerAdminRoutes

export const actionLedgerModule: Module = {
  name: "action-ledger",
}

export const actionLedgerApiModule: ApiModule = {
  module: actionLedgerModule,
  adminRoutes: actionLedgerAdminRoutes,
}

export const __test__ = {
  actionLedgerEntryListQuerySchema,
  actionApprovalListQuerySchema,
  decideActionApprovalBodySchema,
  recordActionLedgerReversalBodySchema,
  requestActionApprovalBodySchema,
  actionDelegationListQuerySchema,
  actionLedgerRelayOutboxListQuerySchema,
  serializeActionApproval,
  serializeActionApprovalDetail,
  serializeActionDelegation,
  serializeActionLedgerEntry,
  serializeActionLedgerEntryDetail,
  // Authored OpenAPI response row schemas (for contract tests)
  actionApprovalSchema,
  actionDelegationSchema,
  actionLedgerEntryDetailSchema,
  actionLedgerEntrySchema,
}
