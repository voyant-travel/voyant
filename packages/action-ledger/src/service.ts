import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, desc, eq, inArray, lt, lte, or, type SQL } from "drizzle-orm"

import {
  type ActionLedgerEntry,
  type ActionLedgerPayload,
  type ActionLedgerRelayOutbox,
  type ActionMutationDetail,
  type ActionSensitiveReadDetail,
  actionLedgerEntries,
  actionLedgerPayloads,
  actionLedgerRelayOutbox,
  actionMutationDetails,
  actionSensitiveReadDetails,
  type NewActionLedgerEntry,
  type NewActionLedgerPayload,
  type NewActionMutationDetail,
  type NewActionSensitiveReadDetail,
} from "./schema.js"

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 200

export class ActionLedgerIdempotencyConflictError extends Error {
  readonly existingActionId: string

  constructor(existingActionId: string) {
    super("Action ledger idempotency key was reused with a different fingerprint")
    this.name = "ActionLedgerIdempotencyConflictError"
    this.existingActionId = existingActionId
  }
}

export interface AppendActionLedgerEntryInput
  extends Omit<NewActionLedgerEntry, "id" | "createdAt" | "occurredAt"> {
  occurredAt?: Date
  mutationDetail?: Omit<NewActionMutationDetail, "actionId">
  sensitiveReadDetail?: Omit<NewActionSensitiveReadDetail, "actionId">
  payloads?: Omit<NewActionLedgerPayload, "id" | "actionId">[]
  enqueueRelay?: boolean | { payloadRef?: string | null }
}

export interface AppendActionLedgerEntryResult {
  entry: ActionLedgerEntry
  replayed: boolean
}

export interface ActionLedgerListCursor {
  occurredAt: string
  id: string
}

export interface ActionLedgerRelayOutboxListCursor {
  createdAt: string
  id: string
}

export interface ListActionLedgerEntriesInput {
  actionName?: string | null
  actionKind?: ActionLedgerEntry["actionKind"]
  actorType?: string | null
  principalType?: ActionLedgerEntry["principalType"]
  principalId?: string | null
  apiTokenId?: string | null
  sessionId?: string | null
  callerType?: string | null
  organizationId?: string | null
  targetType?: string | null
  targetId?: string | null
  routeOrToolName?: string | null
  workflowRunId?: string | null
  workflowStepId?: string | null
  correlationId?: string | null
  causationActionId?: string | null
  capabilityId?: string | null
  capabilityVersion?: string | null
  authorizationSource?: string | null
  approvalId?: string | null
  amendsActionId?: string | null
  idempotencyScope?: string | null
  idempotencyKey?: string | null
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"] | ActionLedgerEntry["evaluatedRisk"][]
  status?: ActionLedgerEntry["status"] | ActionLedgerEntry["status"][]
  cursor?: ActionLedgerListCursor | null
  limit?: number
}

export interface ListActionLedgerEntriesResult {
  entries: ActionLedgerEntry[]
  nextCursor: ActionLedgerListCursor | null
}

export interface ListActionLedgerRelayOutboxInput {
  actionId?: string | null
  organizationId?: string | null
  relayStatus?: ActionLedgerRelayOutbox["relayStatus"] | ActionLedgerRelayOutbox["relayStatus"][]
  dueBefore?: Date | string | null
  cursor?: ActionLedgerRelayOutboxListCursor | null
  limit?: number
}

export interface ListActionLedgerRelayOutboxResult {
  rows: ActionLedgerRelayOutbox[]
  nextCursor: ActionLedgerRelayOutboxListCursor | null
}

export interface GetActionLedgerEntryResult {
  entry: ActionLedgerEntry
  mutationDetail: ActionMutationDetail | null
  sensitiveReadDetail: ActionSensitiveReadDetail | null
  payloads: ActionLedgerPayload[]
  relayOutbox: ActionLedgerRelayOutbox[]
}

export const actionLedgerService = {
  async appendEntry(
    db: AnyDrizzleDb,
    input: AppendActionLedgerEntryInput,
  ): Promise<AppendActionLedgerEntryResult> {
    const existing = await findExistingIdempotentEntry(db, input)
    if (existing) {
      assertSameFingerprint(existing, input.idempotencyFingerprint ?? null)
      return { entry: existing, replayed: true }
    }

    try {
      return await insertEntry(db, input)
    } catch (error) {
      const racedExisting = await findExistingIdempotentEntry(db, input)
      if (racedExisting) {
        assertSameFingerprint(racedExisting, input.idempotencyFingerprint ?? null)
        return { entry: racedExisting, replayed: true }
      }
      throw error
    }
  },

  async listEntries(
    db: AnyDrizzleDb,
    input: ListActionLedgerEntriesInput = {},
  ): Promise<ListActionLedgerEntriesResult> {
    const limit = normalizeListLimit(input.limit)
    const predicate = buildActionLedgerEntriesPredicate(input)

    let query = db.select().from(actionLedgerEntries).$dynamic()
    if (predicate) {
      query = query.where(predicate)
    }

    const rows = await query
      .orderBy(desc(actionLedgerEntries.occurredAt), desc(actionLedgerEntries.id))
      .limit(limit + 1)

    const entries = rows.slice(0, limit)
    return {
      entries,
      nextCursor:
        rows.length > limit && entries.length > 0
          ? toActionLedgerListCursor(entries[entries.length - 1]!)
          : null,
    }
  },

  async listRelayOutbox(
    db: AnyDrizzleDb,
    input: ListActionLedgerRelayOutboxInput = {},
  ): Promise<ListActionLedgerRelayOutboxResult> {
    const limit = normalizeListLimit(input.limit)
    const predicate = buildActionLedgerRelayOutboxPredicate(input)

    let query = db.select().from(actionLedgerRelayOutbox).$dynamic()
    if (predicate) {
      query = query.where(predicate)
    }

    const rows = await query
      .orderBy(desc(actionLedgerRelayOutbox.createdAt), desc(actionLedgerRelayOutbox.id))
      .limit(limit + 1)

    const visibleRows = rows.slice(0, limit)
    return {
      rows: visibleRows,
      nextCursor:
        rows.length > limit && visibleRows.length > 0
          ? toActionLedgerRelayOutboxListCursor(visibleRows[visibleRows.length - 1]!)
          : null,
    }
  },

  async getEntry(db: AnyDrizzleDb, id: string): Promise<GetActionLedgerEntryResult | null> {
    const [entry] = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.id, id))
      .limit(1)

    if (!entry) return null

    const [[mutationDetail], [sensitiveReadDetail], payloads, relayOutbox] = await Promise.all([
      db
        .select()
        .from(actionMutationDetails)
        .where(eq(actionMutationDetails.actionId, id))
        .limit(1),
      db
        .select()
        .from(actionSensitiveReadDetails)
        .where(eq(actionSensitiveReadDetails.actionId, id))
        .limit(1),
      db.select().from(actionLedgerPayloads).where(eq(actionLedgerPayloads.actionId, id)),
      db.select().from(actionLedgerRelayOutbox).where(eq(actionLedgerRelayOutbox.actionId, id)),
    ])

    return {
      entry,
      mutationDetail: mutationDetail ?? null,
      sensitiveReadDetail: sensitiveReadDetail ?? null,
      payloads,
      relayOutbox,
    }
  },
}

async function insertEntry(
  db: AnyDrizzleDb,
  input: AppendActionLedgerEntryInput,
): Promise<AppendActionLedgerEntryResult> {
  const { enqueueRelay, mutationDetail, payloads, sensitiveReadDetail, ...entryInput } = input
  const [entry] = await db
    .insert(actionLedgerEntries)
    .values({
      ...entryInput,
      occurredAt: input.occurredAt,
    })
    .returning()

  if (!entry) {
    throw new Error("Action ledger insert did not return an entry")
  }

  if (mutationDetail) {
    await db.insert(actionMutationDetails).values({
      actionId: entry.id,
      ...mutationDetail,
    })
  }

  if (sensitiveReadDetail) {
    await db.insert(actionSensitiveReadDetails).values({
      actionId: entry.id,
      ...sensitiveReadDetail,
    })
  }

  if (payloads && payloads.length > 0) {
    await db.insert(actionLedgerPayloads).values(
      payloads.map((payload) => ({
        actionId: entry.id,
        ...payload,
      })),
    )
  }

  if (enqueueRelay) {
    const payloadRef = typeof enqueueRelay === "object" ? enqueueRelay.payloadRef : null
    await db.insert(actionLedgerRelayOutbox).values({
      actionId: entry.id,
      organizationId: entry.organizationId,
      payloadRef: payloadRef ?? null,
      relayStatus: "pending",
    })
  }

  return { entry, replayed: false }
}

async function findExistingIdempotentEntry(
  db: AnyDrizzleDb,
  input: AppendActionLedgerEntryInput,
): Promise<ActionLedgerEntry | null> {
  if (!input.idempotencyScope || !input.idempotencyKey) return null

  const [existing] = await db
    .select()
    .from(actionLedgerEntries)
    .where(
      and(
        eq(actionLedgerEntries.idempotencyScope, input.idempotencyScope),
        eq(actionLedgerEntries.actionName, input.actionName),
        eq(actionLedgerEntries.targetType, input.targetType),
        eq(actionLedgerEntries.targetId, input.targetId),
        eq(actionLedgerEntries.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1)

  return existing ?? null
}

function assertSameFingerprint(entry: ActionLedgerEntry, fingerprint: string | null): void {
  if (entry.idempotencyFingerprint !== fingerprint) {
    throw new ActionLedgerIdempotencyConflictError(entry.id)
  }
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT
  if (!Number.isFinite(limit)) return DEFAULT_LIST_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT)
}

function toActionLedgerListCursor(entry: Pick<ActionLedgerEntry, "occurredAt" | "id">) {
  return {
    occurredAt: serializeCursorDate(entry.occurredAt),
    id: entry.id,
  }
}

function toActionLedgerRelayOutboxListCursor(
  row: Pick<ActionLedgerRelayOutbox, "createdAt" | "id">,
) {
  return {
    createdAt: serializeCursorDate(row.createdAt),
    id: row.id,
  }
}

function serializeCursorDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger cursor occurredAt must be a valid timestamp")
  }
  return date.toISOString()
}

function parseCursorDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger cursor occurredAt must be a valid timestamp")
  }
  return date
}

function riskCondition(
  value: ActionLedgerEntry["evaluatedRisk"] | ActionLedgerEntry["evaluatedRisk"][] | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionLedgerEntries.evaluatedRisk, value)
  }
  return eq(actionLedgerEntries.evaluatedRisk, value)
}

function statusCondition(
  value: ActionLedgerEntry["status"] | ActionLedgerEntry["status"][] | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionLedgerEntries.status, value)
  }
  return eq(actionLedgerEntries.status, value)
}

function relayStatusCondition(
  value:
    | ActionLedgerRelayOutbox["relayStatus"]
    | ActionLedgerRelayOutbox["relayStatus"][]
    | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionLedgerRelayOutbox.relayStatus, value)
  }
  return eq(actionLedgerRelayOutbox.relayStatus, value)
}

function buildCursorCondition(cursor: ActionLedgerListCursor): SQL {
  const occurredAt = parseCursorDate(cursor.occurredAt)
  const tieBreaker = and(
    eq(actionLedgerEntries.occurredAt, occurredAt),
    lt(actionLedgerEntries.id, cursor.id),
  )

  return or(lt(actionLedgerEntries.occurredAt, occurredAt), tieBreaker) as SQL
}

function buildRelayOutboxCursorCondition(cursor: ActionLedgerRelayOutboxListCursor): SQL {
  const createdAt = parseCursorDate(cursor.createdAt)
  const tieBreaker = and(
    eq(actionLedgerRelayOutbox.createdAt, createdAt),
    lt(actionLedgerRelayOutbox.id, cursor.id),
  )

  return or(lt(actionLedgerRelayOutbox.createdAt, createdAt), tieBreaker) as SQL
}

function buildActionLedgerRelayOutboxPredicate(
  input: ListActionLedgerRelayOutboxInput,
): SQL | undefined {
  const conditions: SQL[] = []

  if (input.actionId) conditions.push(eq(actionLedgerRelayOutbox.actionId, input.actionId))
  if (input.organizationId) {
    conditions.push(eq(actionLedgerRelayOutbox.organizationId, input.organizationId))
  }

  const entryRelayStatusCondition = relayStatusCondition(input.relayStatus)
  if (entryRelayStatusCondition) conditions.push(entryRelayStatusCondition)

  if (input.dueBefore) {
    conditions.push(lte(actionLedgerRelayOutbox.nextRetryAt, parseCursorDate(input.dueBefore)))
  }

  if (input.cursor) {
    conditions.push(buildRelayOutboxCursorCondition(input.cursor))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

function buildActionLedgerEntriesPredicate(input: ListActionLedgerEntriesInput): SQL | undefined {
  const conditions: SQL[] = []

  if (input.actionName) conditions.push(eq(actionLedgerEntries.actionName, input.actionName))
  if (input.actionKind) conditions.push(eq(actionLedgerEntries.actionKind, input.actionKind))
  if (input.actorType) conditions.push(eq(actionLedgerEntries.actorType, input.actorType))
  if (input.principalType) {
    conditions.push(eq(actionLedgerEntries.principalType, input.principalType))
  }
  if (input.principalId) conditions.push(eq(actionLedgerEntries.principalId, input.principalId))
  if (input.apiTokenId) conditions.push(eq(actionLedgerEntries.apiTokenId, input.apiTokenId))
  if (input.sessionId) conditions.push(eq(actionLedgerEntries.sessionId, input.sessionId))
  if (input.callerType) conditions.push(eq(actionLedgerEntries.callerType, input.callerType))
  if (input.organizationId) {
    conditions.push(eq(actionLedgerEntries.organizationId, input.organizationId))
  }
  if (input.targetType) conditions.push(eq(actionLedgerEntries.targetType, input.targetType))
  if (input.targetId) conditions.push(eq(actionLedgerEntries.targetId, input.targetId))
  if (input.routeOrToolName) {
    conditions.push(eq(actionLedgerEntries.routeOrToolName, input.routeOrToolName))
  }
  if (input.workflowRunId) {
    conditions.push(eq(actionLedgerEntries.workflowRunId, input.workflowRunId))
  }
  if (input.workflowStepId) {
    conditions.push(eq(actionLedgerEntries.workflowStepId, input.workflowStepId))
  }
  if (input.correlationId) {
    conditions.push(eq(actionLedgerEntries.correlationId, input.correlationId))
  }
  if (input.causationActionId) {
    conditions.push(eq(actionLedgerEntries.causationActionId, input.causationActionId))
  }
  if (input.capabilityId) conditions.push(eq(actionLedgerEntries.capabilityId, input.capabilityId))
  if (input.capabilityVersion) {
    conditions.push(eq(actionLedgerEntries.capabilityVersion, input.capabilityVersion))
  }
  if (input.authorizationSource) {
    conditions.push(eq(actionLedgerEntries.authorizationSource, input.authorizationSource))
  }
  if (input.approvalId) conditions.push(eq(actionLedgerEntries.approvalId, input.approvalId))
  if (input.amendsActionId) {
    conditions.push(eq(actionLedgerEntries.amendsActionId, input.amendsActionId))
  }
  if (input.idempotencyScope) {
    conditions.push(eq(actionLedgerEntries.idempotencyScope, input.idempotencyScope))
  }
  if (input.idempotencyKey) {
    conditions.push(eq(actionLedgerEntries.idempotencyKey, input.idempotencyKey))
  }

  const evaluatedRiskCondition = riskCondition(input.evaluatedRisk)
  if (evaluatedRiskCondition) conditions.push(evaluatedRiskCondition)

  const entryStatusCondition = statusCondition(input.status)
  if (entryStatusCondition) conditions.push(entryStatusCondition)

  if (input.cursor) {
    conditions.push(buildCursorCondition(input.cursor))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

export const __test__ = {
  buildActionLedgerEntriesPredicate,
  buildActionLedgerRelayOutboxPredicate,
  normalizeListLimit,
  toActionLedgerListCursor,
  toActionLedgerRelayOutboxListCursor,
}
