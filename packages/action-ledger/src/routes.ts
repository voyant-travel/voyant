import type { Module } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { parseQuery } from "@voyantjs/hono"
import type { HonoModule } from "@voyantjs/hono/module"
import { type Context, Hono } from "hono"
import { z } from "zod"

import type {
  ActionLedgerEntry,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "./schema.js"
import { actionLedgerService, type GetActionLedgerEntryResult } from "./service.js"

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
    actorType: z.string().trim().min(1).optional(),
    principalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    principalId: z.string().trim().min(1).optional(),
    apiTokenId: z.string().trim().min(1).optional(),
    sessionId: z.string().trim().min(1).optional(),
    targetType: z.string().trim().min(1).optional(),
    targetId: z.string().trim().min(1).optional(),
    workflowRunId: z.string().trim().min(1).optional(),
    workflowStepId: z.string().trim().min(1).optional(),
    correlationId: z.string().trim().min(1).optional(),
    causationActionId: z.string().trim().min(1).optional(),
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
}

export interface ActionLedgerGetResponse {
  data: ActionLedgerEntryDetailResponse
}

function serializeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger entry timestamp must be a valid date")
  }
  return date.toISOString()
}

function serializeActionLedgerEntry(entry: ActionLedgerEntry): ActionLedgerEntryResponse {
  return {
    ...entry,
    occurredAt: serializeDate(entry.occurredAt),
    createdAt: serializeDate(entry.createdAt),
  }
}

function serializeActionLedgerEntryDetail(
  result: GetActionLedgerEntryResult,
): ActionLedgerEntryDetailResponse {
  return {
    ...serializeActionLedgerEntry(result.entry),
    mutationDetail: result.mutationDetail,
    sensitiveReadDetail: result.sensitiveReadDetail,
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
