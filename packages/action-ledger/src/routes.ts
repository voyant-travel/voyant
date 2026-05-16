import type { Module } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { HonoModule } from "@voyantjs/hono/module"
import { type Context, Hono } from "hono"
import { z } from "zod"

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
  actionLedgerService,
  type GetActionApprovalResult,
  type GetActionDelegationResult,
  type GetActionLedgerEntryResult,
} from "./service.js"

const actionLedgerActionKindValues = [
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
] as const
const actionLedgerPrincipalTypeValues = ["user", "api_key", "agent", "workflow", "system"] as const
const actionLedgerRiskValues = ["low", "medium", "high", "critical"] as const
const actionLedgerStatusValues = [
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
] as const
const actionLedgerApprovalStatusValues = [
  "pending",
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
] as const
const actionLedgerRelayStatusValues = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "dead_letter",
] as const
const actionLedgerReversalKindValues = ["none", "revert", "compensate", "domain_command"] as const
const actionLedgerReversalStateValues = [
  "not_reversible",
  "available",
  "requested",
  "running",
  "completed",
  "failed",
  "expired",
] as const
const actionLedgerReversalOutcomeValues = ["full", "partial", "failed"] as const

type NonEmptyEnumValues = readonly [string, ...string[]]

function commaSeparatedEnumList<const TValues extends NonEmptyEnumValues>(values: TValues) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  }, z.array(z.enum(values)).min(1).optional())
}

function commaSeparatedStringList() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  }, z.array(z.string().trim().min(1)).min(1).optional())
}

const actionLedgerEntryListQuerySchema = z
  .object({
    actionName: z.string().trim().min(1).optional(),
    actionKind: z.enum(actionLedgerActionKindValues).optional(),
    actorType: z.string().trim().min(1).optional(),
    principalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    principalId: z.string().trim().min(1).optional(),
    apiTokenId: z.string().trim().min(1).optional(),
    sessionId: z.string().trim().min(1).optional(),
    callerType: z.string().trim().min(1).optional(),
    organizationId: z.string().trim().min(1).optional(),
    targetType: z.string().trim().min(1).optional(),
    targetId: z.string().trim().min(1).optional(),
    targetIds: commaSeparatedStringList(),
    routeOrToolName: z.string().trim().min(1).optional(),
    workflowRunId: z.string().trim().min(1).optional(),
    workflowStepId: z.string().trim().min(1).optional(),
    correlationId: z.string().trim().min(1).optional(),
    causationActionId: z.string().trim().min(1).optional(),
    capabilityId: z.string().trim().min(1).optional(),
    capabilityVersion: z.string().trim().min(1).optional(),
    authorizationSource: z.string().trim().min(1).optional(),
    approvalId: z.string().trim().min(1).optional(),
    amendsActionId: z.string().trim().min(1).optional(),
    idempotencyScope: z.string().trim().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).optional(),
    evaluatedRisk: commaSeparatedEnumList(actionLedgerRiskValues),
    status: commaSeparatedEnumList(actionLedgerStatusValues),
    reversalKind: commaSeparatedEnumList(actionLedgerReversalKindValues),
    reversalState: commaSeparatedEnumList(actionLedgerReversalStateValues),
    reversalOutcome: commaSeparatedEnumList(actionLedgerReversalOutcomeValues),
    reversesActionId: z.string().trim().min(1).optional(),
    reversedByActionId: z.string().trim().min(1).optional(),
    sensitiveReasonCode: z.string().trim().min(1).optional(),
    decisionPolicy: z.string().trim().min(1).optional(),
    occurredAtFrom: z.string().datetime().optional(),
    occurredAtTo: z.string().datetime().optional(),
    cursorOccurredAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorOccurredAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorOccurredAt ? ["cursorId"] : ["cursorOccurredAt"],
      message: "cursorOccurredAt and cursorId must be provided together",
    })
  })
  .superRefine((value, ctx) => {
    if (!value.targetId || !value.targetIds) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetIds"],
      message: "targetId and targetIds cannot be provided together",
    })
  })
  .transform(({ cursorOccurredAt, cursorId, occurredAtFrom, occurredAtTo, ...query }) => ({
    ...query,
    occurredAtFrom: occurredAtFrom ? new Date(occurredAtFrom) : undefined,
    occurredAtTo: occurredAtTo ? new Date(occurredAtTo) : undefined,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

type ActionLedgerEntryListQuery = z.infer<typeof actionLedgerEntryListQuerySchema>

const actionLedgerRelayOutboxListQuerySchema = z
  .object({
    actionId: z.string().trim().min(1).optional(),
    organizationId: z.string().trim().min(1).optional(),
    relayStatus: commaSeparatedEnumList(actionLedgerRelayStatusValues),
    dueBefore: z.string().datetime().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    processedAtFrom: z.string().datetime().optional(),
    processedAtTo: z.string().datetime().optional(),
    cursorCreatedAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorCreatedAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorCreatedAt ? ["cursorId"] : ["cursorCreatedAt"],
      message: "cursorCreatedAt and cursorId must be provided together",
    })
  })
  .transform(
    ({
      cursorCreatedAt,
      cursorId,
      dueBefore,
      createdAtFrom,
      createdAtTo,
      processedAtFrom,
      processedAtTo,
      ...query
    }) => ({
      ...query,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      processedAtFrom: processedAtFrom ? new Date(processedAtFrom) : undefined,
      processedAtTo: processedAtTo ? new Date(processedAtTo) : undefined,
      cursor:
        cursorCreatedAt && cursorId
          ? {
              createdAt: cursorCreatedAt,
              id: cursorId,
            }
          : undefined,
    }),
  )

type ActionLedgerRelayOutboxListQuery = z.infer<typeof actionLedgerRelayOutboxListQuerySchema>

const actionApprovalListQuerySchema = z
  .object({
    requestedActionId: z.string().trim().min(1).optional(),
    status: commaSeparatedEnumList(actionLedgerApprovalStatusValues),
    requestedByPrincipalId: z.string().trim().min(1).optional(),
    assignedToPrincipalId: z.string().trim().min(1).optional(),
    decidedByPrincipalId: z.string().trim().min(1).optional(),
    delegatedFromPrincipalId: z.string().trim().min(1).optional(),
    policyName: z.string().trim().min(1).optional(),
    policyVersion: z.string().trim().min(1).optional(),
    riskSnapshot: commaSeparatedEnumList(actionLedgerRiskValues),
    reasonCode: z.string().trim().min(1).optional(),
    expiresAtFrom: z.string().datetime().optional(),
    expiresAtTo: z.string().datetime().optional(),
    decidedAtFrom: z.string().datetime().optional(),
    decidedAtTo: z.string().datetime().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    cursorCreatedAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorCreatedAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorCreatedAt ? ["cursorId"] : ["cursorCreatedAt"],
      message: "cursorCreatedAt and cursorId must be provided together",
    })
  })
  .transform(
    ({
      cursorCreatedAt,
      cursorId,
      expiresAtFrom,
      expiresAtTo,
      decidedAtFrom,
      decidedAtTo,
      createdAtFrom,
      createdAtTo,
      ...query
    }) => ({
      ...query,
      expiresAtFrom: expiresAtFrom ? new Date(expiresAtFrom) : undefined,
      expiresAtTo: expiresAtTo ? new Date(expiresAtTo) : undefined,
      decidedAtFrom: decidedAtFrom ? new Date(decidedAtFrom) : undefined,
      decidedAtTo: decidedAtTo ? new Date(decidedAtTo) : undefined,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      cursor:
        cursorCreatedAt && cursorId
          ? {
              createdAt: cursorCreatedAt,
              id: cursorId,
            }
          : undefined,
    }),
  )

type ActionApprovalListQuery = z.infer<typeof actionApprovalListQuerySchema>

const nullableTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => value ?? null)

const actionLedgerApprovalRequestedActionBodySchema = z.object({
  actionName: z.string().trim().min(1),
  actionVersion: z.string().trim().min(1).default("v1"),
  actionKind: z.enum(actionLedgerActionKindValues),
  evaluatedRisk: z.enum(actionLedgerRiskValues),
  actorType: nullableTrimmedString,
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string().trim().min(1),
  principalSubtype: nullableTrimmedString,
  sessionId: nullableTrimmedString,
  apiTokenId: nullableTrimmedString,
  internalRequest: z.boolean().default(false),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
  delegatedByPrincipalId: nullableTrimmedString,
  delegationId: nullableTrimmedString,
  callerType: nullableTrimmedString,
  organizationId: nullableTrimmedString,
  routeOrToolName: nullableTrimmedString,
  workflowRunId: nullableTrimmedString,
  workflowStepId: nullableTrimmedString,
  correlationId: nullableTrimmedString,
  causationActionId: nullableTrimmedString,
  idempotencyScope: nullableTrimmedString,
  idempotencyKey: nullableTrimmedString,
  idempotencyFingerprint: nullableTrimmedString,
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  capabilityId: nullableTrimmedString,
  capabilityVersion: nullableTrimmedString,
  authorizationSource: nullableTrimmedString,
  amendsActionId: nullableTrimmedString,
})

const requestActionApprovalBodySchema = z
  .object({
    requestedAction: actionLedgerApprovalRequestedActionBodySchema,
    approval: z.object({
      requestedByPrincipalId: nullableTrimmedString,
      assignedToPrincipalId: nullableTrimmedString,
      delegatedFromPrincipalId: nullableTrimmedString,
      policyName: z.string().trim().min(1),
      policyVersion: z.string().trim().min(1),
      targetSnapshotRef: nullableTrimmedString,
      riskSnapshot: z.enum(actionLedgerRiskValues).optional(),
      reasonCode: nullableTrimmedString,
      expiresAt: z.string().datetime().optional(),
    }),
  })
  .transform(({ approval, ...body }) => ({
    ...body,
    approval: {
      ...approval,
      riskSnapshot: approval.riskSnapshot ?? null,
      expiresAt: approval.expiresAt ? new Date(approval.expiresAt) : null,
    },
  }))

type RequestActionApprovalBody = z.infer<typeof requestActionApprovalBodySchema>

const actionLedgerApprovalDecisionStatusValues = [
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
] as const

const actionLedgerApprovalDecisionActionBodySchema = z.object({
  actionName: z.string().trim().min(1),
  actionVersion: z.string().trim().min(1).default("v1"),
  actorType: nullableTrimmedString,
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string().trim().min(1),
  principalSubtype: nullableTrimmedString,
  sessionId: nullableTrimmedString,
  apiTokenId: nullableTrimmedString,
  internalRequest: z.boolean().default(false),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
  delegatedByPrincipalId: nullableTrimmedString,
  delegationId: nullableTrimmedString,
  callerType: nullableTrimmedString,
  organizationId: nullableTrimmedString,
  routeOrToolName: nullableTrimmedString,
  workflowRunId: nullableTrimmedString,
  workflowStepId: nullableTrimmedString,
  correlationId: nullableTrimmedString,
  idempotencyScope: nullableTrimmedString,
  idempotencyKey: nullableTrimmedString,
  idempotencyFingerprint: nullableTrimmedString,
  capabilityId: nullableTrimmedString,
  capabilityVersion: nullableTrimmedString,
  authorizationSource: nullableTrimmedString,
  amendsActionId: nullableTrimmedString,
})

const decideActionApprovalBodySchema = z
  .object({
    status: z.enum(actionLedgerApprovalDecisionStatusValues),
    decidedByPrincipalId: z.string().trim().min(1),
    decidedAt: z.string().datetime().optional(),
    decisionAction: actionLedgerApprovalDecisionActionBodySchema,
  })
  .transform(({ decidedAt, ...body }) => ({
    ...body,
    decidedAt: decidedAt ? new Date(decidedAt) : undefined,
  }))

type DecideActionApprovalBody = z.infer<typeof decideActionApprovalBodySchema>

const actionDelegationListQuerySchema = z
  .object({
    rootPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    rootPrincipalId: z.string().trim().min(1).optional(),
    parentPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    parentPrincipalId: z.string().trim().min(1).optional(),
    childPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    childPrincipalId: z.string().trim().min(1).optional(),
    grantSource: z.string().trim().min(1).optional(),
    capabilityScopeRef: z.string().trim().min(1).optional(),
    budgetScopeRef: z.string().trim().min(1).optional(),
    expiresAtFrom: z.string().datetime().optional(),
    expiresAtTo: z.string().datetime().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    cursorCreatedAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorCreatedAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorCreatedAt ? ["cursorId"] : ["cursorCreatedAt"],
      message: "cursorCreatedAt and cursorId must be provided together",
    })
  })
  .transform(
    ({
      cursorCreatedAt,
      cursorId,
      expiresAtFrom,
      expiresAtTo,
      createdAtFrom,
      createdAtTo,
      ...query
    }) => ({
      ...query,
      expiresAtFrom: expiresAtFrom ? new Date(expiresAtFrom) : undefined,
      expiresAtTo: expiresAtTo ? new Date(expiresAtTo) : undefined,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      cursor:
        cursorCreatedAt && cursorId
          ? {
              createdAt: cursorCreatedAt,
              id: cursorId,
            }
          : undefined,
    }),
  )

type ActionDelegationListQuery = z.infer<typeof actionDelegationListQuerySchema>

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

async function listActionLedgerEntries(c: Context<Env>) {
  const query: ActionLedgerEntryListQuery = parseQuery(c, actionLedgerEntryListQuerySchema)
  const result = await actionLedgerService.listEntries(c.get("db"), query)

  return c.json({
    data: result.entries.map(serializeActionLedgerEntry),
    pageInfo: {
      nextCursor: result.nextCursor,
    },
  } satisfies ActionLedgerListResponse)
}

async function listActionLedgerRelayOutbox(c: Context<Env>) {
  const query: ActionLedgerRelayOutboxListQuery = parseQuery(
    c,
    actionLedgerRelayOutboxListQuerySchema,
  )
  const result = await actionLedgerService.listRelayOutbox(c.get("db"), query)

  return c.json({
    data: result.rows.map(serializeActionLedgerRelayOutbox),
    pageInfo: {
      nextCursor: result.nextCursor,
    },
  } satisfies ActionLedgerRelayOutboxListResponse)
}

async function listActionApprovals(c: Context<Env>) {
  const query: ActionApprovalListQuery = parseQuery(c, actionApprovalListQuerySchema)
  const result = await actionLedgerService.listApprovals(c.get("db"), query)

  return c.json({
    data: result.approvals.map(serializeActionApproval),
    pageInfo: {
      nextCursor: result.nextCursor,
    },
  } satisfies ActionApprovalListResponse)
}

async function listActionDelegations(c: Context<Env>) {
  const query: ActionDelegationListQuery = parseQuery(c, actionDelegationListQuerySchema)
  const result = await actionLedgerService.listDelegations(c.get("db"), query)

  return c.json({
    data: result.delegations.map(serializeActionDelegation),
    pageInfo: {
      nextCursor: result.nextCursor,
    },
  } satisfies ActionDelegationListResponse)
}

async function requestActionApproval(c: Context<Env>) {
  const body: RequestActionApprovalBody = await parseJsonBody(c, requestActionApprovalBodySchema)
  const result = await actionLedgerService.requestApproval(c.get("db"), body)

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
}

async function decideActionApproval(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  const body: DecideActionApprovalBody = await parseJsonBody(c, decideActionApprovalBodySchema)

  try {
    const result = await actionLedgerService.decideApproval(c.get("db"), {
      id,
      ...body,
    })

    if (!result) {
      return c.json({ error: "Action approval not found" }, 404)
    }

    return c.json({
      data: {
        approval: serializeActionApproval(result.approval),
        decisionAction: serializeActionLedgerEntry(result.decisionAction),
      },
    } satisfies ActionApprovalDecisionResponse)
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
}

async function getActionApproval(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  const result = await actionLedgerService.getApproval(c.get("db"), id)

  if (!result) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  return c.json({
    data: serializeActionApprovalDetail(result),
  } satisfies ActionApprovalGetResponse)
}

async function getActionDelegation(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Action delegation not found" }, 404)
  }

  const result = await actionLedgerService.getDelegation(c.get("db"), id)

  if (!result) {
    return c.json({ error: "Action delegation not found" }, 404)
  }

  return c.json({
    data: serializeActionDelegationDetail(result),
  } satisfies ActionDelegationGetResponse)
}

async function getActionLedgerEntry(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Action ledger entry not found" }, 404)
  }

  const result = await actionLedgerService.getEntry(c.get("db"), id)

  if (!result) {
    return c.json({ error: "Action ledger entry not found" }, 404)
  }

  return c.json({
    data: serializeActionLedgerEntryDetail(result),
  } satisfies ActionLedgerGetResponse)
}

export const actionLedgerAdminRoutes = new Hono<Env>()
  .get("/", listActionLedgerEntries)
  .get("/entries", listActionLedgerEntries)
  .get("/approvals", listActionApprovals)
  .post("/approvals/request", requestActionApproval)
  .get("/approvals/:id", getActionApproval)
  .post("/approvals/:id/decide", decideActionApproval)
  .get("/delegations", listActionDelegations)
  .get("/delegations/:id", getActionDelegation)
  .get("/relay-outbox", listActionLedgerRelayOutbox)
  .get("/entries/:id", getActionLedgerEntry)

export type ActionLedgerAdminRoutes = typeof actionLedgerAdminRoutes

export const actionLedgerModule: Module = {
  name: "action-ledger",
}

export const actionLedgerHonoModule: HonoModule = {
  module: actionLedgerModule,
  adminRoutes: actionLedgerAdminRoutes,
}

export const __test__ = {
  actionLedgerEntryListQuerySchema,
  actionApprovalListQuerySchema,
  decideActionApprovalBodySchema,
  requestActionApprovalBodySchema,
  actionDelegationListQuerySchema,
  actionLedgerRelayOutboxListQuerySchema,
  serializeActionApproval,
  serializeActionApprovalDetail,
  serializeActionDelegation,
  serializeActionLedgerEntry,
  serializeActionLedgerEntryDetail,
}
