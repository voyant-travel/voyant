import type { Module } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"
import { type Context, Hono } from "hono"
import {
  type ActionApprovalListQuery,
  type ActionDelegationListQuery,
  type ActionLedgerEntryListQuery,
  type ActionLedgerRelayOutboxListQuery,
  actionApprovalListQuerySchema,
  actionDelegationListQuerySchema,
  actionLedgerEntryListQuerySchema,
  actionLedgerRelayOutboxListQuerySchema,
  type DecideActionApprovalBody,
  decideActionApprovalBodySchema,
  type RecordActionLedgerReversalBody,
  type RequestActionApprovalBody,
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

async function recordActionLedgerReversal(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Action ledger entry not found" }, 404)
  }

  const body: RecordActionLedgerReversalBody = await parseJsonBody(
    c,
    recordActionLedgerReversalBodySchema,
  )

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

    return c.json({
      data: {
        originalAction: serializeActionLedgerEntry(result.originalAction),
        reversalAction: serializeActionLedgerEntry(result.reversalAction),
        replayed: result.replayed,
      },
    } satisfies ActionLedgerReversalResponse)
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
  .post("/entries/:id/reversals", recordActionLedgerReversal)
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
  recordActionLedgerReversalBodySchema,
  requestActionApprovalBodySchema,
  actionDelegationListQuerySchema,
  actionLedgerRelayOutboxListQuerySchema,
  serializeActionApproval,
  serializeActionApprovalDetail,
  serializeActionDelegation,
  serializeActionLedgerEntry,
  serializeActionLedgerEntryDetail,
}
