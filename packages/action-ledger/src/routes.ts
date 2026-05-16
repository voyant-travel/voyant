import type { Module } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { parseQuery } from "@voyantjs/hono"
import type { HonoModule } from "@voyantjs/hono/module"
import { type Context, Hono } from "hono"
import { z } from "zod"

import type {
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "./schema.js"
import { actionLedgerService, type GetActionLedgerEntryResult } from "./service.js"

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
  .transform(({ cursorOccurredAt, cursorId, ...query }) => ({
    ...query,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

type ActionLedgerEntryListQuery = z.infer<typeof actionLedgerEntryListQuerySchema>

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
  serializeActionLedgerEntry,
  serializeActionLedgerEntryDetail,
}
