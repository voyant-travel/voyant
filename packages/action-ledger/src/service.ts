import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, desc, eq, gte, inArray, lt, lte, or, type SQL, sql } from "drizzle-orm"

import {
  type ActionApproval,
  type ActionDelegation,
  type ActionLedgerEntry,
  type ActionLedgerPayload,
  type ActionLedgerRelayOutbox,
  type ActionMutationDetail,
  type ActionSensitiveReadDetail,
  actionApprovals,
  actionDelegations,
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

export interface ActionApprovalListCursor {
  createdAt: string
  id: string
}

export interface ActionDelegationListCursor {
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
  reversalKind?: ActionMutationDetail["reversalKind"] | ActionMutationDetail["reversalKind"][]
  reversalState?:
    | NonNullable<ActionMutationDetail["reversalStateProjection"]>
    | NonNullable<ActionMutationDetail["reversalStateProjection"]>[]
  reversalOutcome?:
    | NonNullable<ActionMutationDetail["reversalOutcomeProjection"]>
    | NonNullable<ActionMutationDetail["reversalOutcomeProjection"]>[]
  reversesActionId?: string | null
  reversedByActionId?: string | null
  sensitiveReasonCode?: string | null
  decisionPolicy?: string | null
  occurredAtFrom?: Date | string | null
  occurredAtTo?: Date | string | null
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
  createdAtFrom?: Date | string | null
  createdAtTo?: Date | string | null
  processedAtFrom?: Date | string | null
  processedAtTo?: Date | string | null
  cursor?: ActionLedgerRelayOutboxListCursor | null
  limit?: number
}

export interface ListActionLedgerRelayOutboxResult {
  rows: ActionLedgerRelayOutbox[]
  nextCursor: ActionLedgerRelayOutboxListCursor | null
}

export interface ListActionApprovalsInput {
  requestedActionId?: string | null
  status?: ActionApproval["status"] | ActionApproval["status"][]
  requestedByPrincipalId?: string | null
  assignedToPrincipalId?: string | null
  decidedByPrincipalId?: string | null
  delegatedFromPrincipalId?: string | null
  policyName?: string | null
  policyVersion?: string | null
  riskSnapshot?: ActionApproval["riskSnapshot"] | ActionApproval["riskSnapshot"][]
  reasonCode?: string | null
  expiresAtFrom?: Date | string | null
  expiresAtTo?: Date | string | null
  decidedAtFrom?: Date | string | null
  decidedAtTo?: Date | string | null
  createdAtFrom?: Date | string | null
  createdAtTo?: Date | string | null
  cursor?: ActionApprovalListCursor | null
  limit?: number
}

export interface ListActionApprovalsResult {
  approvals: ActionApproval[]
  nextCursor: ActionApprovalListCursor | null
}

export interface ListActionDelegationsInput {
  rootPrincipalType?: ActionDelegation["rootPrincipalType"]
  rootPrincipalId?: string | null
  parentPrincipalType?: ActionDelegation["parentPrincipalType"]
  parentPrincipalId?: string | null
  childPrincipalType?: ActionDelegation["childPrincipalType"]
  childPrincipalId?: string | null
  grantSource?: string | null
  capabilityScopeRef?: string | null
  budgetScopeRef?: string | null
  expiresAtFrom?: Date | string | null
  expiresAtTo?: Date | string | null
  createdAtFrom?: Date | string | null
  createdAtTo?: Date | string | null
  cursor?: ActionDelegationListCursor | null
  limit?: number
}

export interface ListActionDelegationsResult {
  delegations: ActionDelegation[]
  nextCursor: ActionDelegationListCursor | null
}

export interface ClaimActionLedgerRelayOutboxInput {
  organizationId?: string | null
  dueAt?: Date | string | null
  limit?: number
}

export interface ClaimActionLedgerRelayOutboxResult {
  rows: ActionLedgerRelayOutbox[]
}

export interface MarkActionLedgerRelayOutboxSucceededInput {
  id: string
  processedAt?: Date | string | null
}

export interface MarkActionLedgerRelayOutboxFailedInput {
  id: string
  lastError: string
  nextRetryAt?: Date | string | null
  deadLetter?: boolean
  processedAt?: Date | string | null
}

export interface GetActionLedgerEntryResult {
  entry: ActionLedgerEntry
  mutationDetail: ActionMutationDetail | null
  sensitiveReadDetail: ActionSensitiveReadDetail | null
  payloads: ActionLedgerPayload[]
  relayOutbox: ActionLedgerRelayOutbox[]
}

export interface GetActionApprovalResult {
  approval: ActionApproval
  requestedAction: GetActionLedgerEntryResult | null
}

export interface GetActionDelegationResult {
  delegation: ActionDelegation
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

  async listApprovals(
    db: AnyDrizzleDb,
    input: ListActionApprovalsInput = {},
  ): Promise<ListActionApprovalsResult> {
    const limit = normalizeListLimit(input.limit)
    const predicate = buildActionApprovalsPredicate(input)

    let query = db.select().from(actionApprovals).$dynamic()
    if (predicate) {
      query = query.where(predicate)
    }

    const rows = await query
      .orderBy(desc(actionApprovals.createdAt), desc(actionApprovals.id))
      .limit(limit + 1)

    const approvals = rows.slice(0, limit)
    return {
      approvals,
      nextCursor:
        rows.length > limit && approvals.length > 0
          ? toActionApprovalListCursor(approvals[approvals.length - 1]!)
          : null,
    }
  },

  async listDelegations(
    db: AnyDrizzleDb,
    input: ListActionDelegationsInput = {},
  ): Promise<ListActionDelegationsResult> {
    const limit = normalizeListLimit(input.limit)
    const predicate = buildActionDelegationsPredicate(input)

    let query = db.select().from(actionDelegations).$dynamic()
    if (predicate) {
      query = query.where(predicate)
    }

    const rows = await query
      .orderBy(desc(actionDelegations.createdAt), desc(actionDelegations.id))
      .limit(limit + 1)

    const delegations = rows.slice(0, limit)
    return {
      delegations,
      nextCursor:
        rows.length > limit && delegations.length > 0
          ? toActionDelegationListCursor(delegations[delegations.length - 1]!)
          : null,
    }
  },

  async getApproval(db: AnyDrizzleDb, id: string): Promise<GetActionApprovalResult | null> {
    const [approval] = await db
      .select()
      .from(actionApprovals)
      .where(eq(actionApprovals.id, id))
      .limit(1)

    if (!approval) return null

    return {
      approval,
      requestedAction: await actionLedgerService.getEntry(db, approval.requestedActionId),
    }
  },

  async getDelegation(db: AnyDrizzleDb, id: string): Promise<GetActionDelegationResult | null> {
    const [delegation] = await db
      .select()
      .from(actionDelegations)
      .where(eq(actionDelegations.id, id))
      .limit(1)

    if (!delegation) return null
    return { delegation }
  },

  async claimRelayOutbox(
    db: AnyDrizzleDb,
    input: ClaimActionLedgerRelayOutboxInput = {},
  ): Promise<ClaimActionLedgerRelayOutboxResult> {
    const limit = normalizeListLimit(input.limit)
    const dueAt = input.dueAt ? parseCursorDate(input.dueAt) : new Date()
    const organizationId = input.organizationId ?? null
    const result = await db.execute<ActionLedgerRelayOutboxSqlRow>(sql`
      WITH due AS (
        SELECT id
        FROM action_ledger_outbox
        WHERE relay_status IN ('pending', 'failed')
          AND (${organizationId}::text IS NULL OR organization_id = ${organizationId})
          AND (next_retry_at IS NULL OR next_retry_at <= ${dueAt})
        ORDER BY created_at ASC, id ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE action_ledger_outbox AS outbox
      SET relay_status = 'processing',
          attempt_count = outbox.attempt_count + 1,
          last_error = NULL,
          processed_at = NULL
      FROM due
      WHERE outbox.id = due.id
      RETURNING
        outbox.id,
        outbox.action_id,
        outbox.organization_id,
        outbox.relay_status,
        outbox.payload_ref,
        outbox.attempt_count,
        outbox.next_retry_at,
        outbox.last_error,
        outbox.created_at,
        outbox.processed_at
    `)

    const rows = ("rows" in result ? result.rows : result) as ActionLedgerRelayOutboxSqlRow[]
    return {
      rows: rows.map(actionLedgerRelayOutboxFromSqlRow),
    }
  },

  async markRelayOutboxSucceeded(
    db: AnyDrizzleDb,
    input: MarkActionLedgerRelayOutboxSucceededInput,
  ): Promise<ActionLedgerRelayOutbox | null> {
    const [row] = await db
      .update(actionLedgerRelayOutbox)
      .set({
        relayStatus: "succeeded",
        nextRetryAt: null,
        lastError: null,
        processedAt: input.processedAt ? parseCursorDate(input.processedAt) : new Date(),
      })
      .where(
        and(
          eq(actionLedgerRelayOutbox.id, input.id),
          eq(actionLedgerRelayOutbox.relayStatus, "processing"),
        ),
      )
      .returning()

    return row ?? null
  },

  async markRelayOutboxFailed(
    db: AnyDrizzleDb,
    input: MarkActionLedgerRelayOutboxFailedInput,
  ): Promise<ActionLedgerRelayOutbox | null> {
    const deadLetter = input.deadLetter ?? false
    const [row] = await db
      .update(actionLedgerRelayOutbox)
      .set({
        relayStatus: deadLetter ? "dead_letter" : "failed",
        nextRetryAt: deadLetter
          ? null
          : input.nextRetryAt
            ? parseCursorDate(input.nextRetryAt)
            : null,
        lastError: input.lastError,
        processedAt: deadLetter
          ? input.processedAt
            ? parseCursorDate(input.processedAt)
            : new Date()
          : null,
      })
      .where(
        and(
          eq(actionLedgerRelayOutbox.id, input.id),
          eq(actionLedgerRelayOutbox.relayStatus, "processing"),
        ),
      )
      .returning()

    return row ?? null
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

type ActionLedgerRelayOutboxSqlRow = {
  id: string
  action_id: string
  organization_id: string | null
  relay_status: ActionLedgerRelayOutbox["relayStatus"]
  payload_ref: string | null
  attempt_count: number | string
  next_retry_at: Date | string | null
  last_error: string | null
  created_at: Date | string
  processed_at: Date | string | null
}

function actionLedgerRelayOutboxFromSqlRow(
  row: ActionLedgerRelayOutboxSqlRow,
): ActionLedgerRelayOutbox {
  return {
    id: row.id,
    actionId: row.action_id,
    organizationId: row.organization_id,
    relayStatus: row.relay_status,
    payloadRef: row.payload_ref,
    attemptCount: Number(row.attempt_count),
    nextRetryAt: row.next_retry_at ? parseCursorDate(row.next_retry_at) : null,
    lastError: row.last_error,
    createdAt: parseCursorDate(row.created_at),
    processedAt: row.processed_at ? parseCursorDate(row.processed_at) : null,
  }
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

function toActionApprovalListCursor(row: Pick<ActionApproval, "createdAt" | "id">) {
  return {
    createdAt: serializeCursorDate(row.createdAt),
    id: row.id,
  }
}

function toActionDelegationListCursor(row: Pick<ActionDelegation, "createdAt" | "id">) {
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

function approvalStatusCondition(
  value: ActionApproval["status"] | ActionApproval["status"][] | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionApprovals.status, value)
  }
  return eq(actionApprovals.status, value)
}

function approvalRiskCondition(
  value: ActionApproval["riskSnapshot"] | ActionApproval["riskSnapshot"][] | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionApprovals.riskSnapshot, value)
  }
  return eq(actionApprovals.riskSnapshot, value)
}

function reversalKindCondition(
  value: ActionMutationDetail["reversalKind"] | ActionMutationDetail["reversalKind"][] | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionMutationDetails.reversalKind, value)
  }
  return eq(actionMutationDetails.reversalKind, value)
}

function reversalStateCondition(
  value:
    | NonNullable<ActionMutationDetail["reversalStateProjection"]>
    | NonNullable<ActionMutationDetail["reversalStateProjection"]>[]
    | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionMutationDetails.reversalStateProjection, value)
  }
  return eq(actionMutationDetails.reversalStateProjection, value)
}

function reversalOutcomeCondition(
  value:
    | NonNullable<ActionMutationDetail["reversalOutcomeProjection"]>
    | NonNullable<ActionMutationDetail["reversalOutcomeProjection"]>[]
    | undefined,
): SQL | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return inArray(actionMutationDetails.reversalOutcomeProjection, value)
  }
  return eq(actionMutationDetails.reversalOutcomeProjection, value)
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

function mutationDetailExists(condition: SQL): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${actionMutationDetails}
    WHERE ${actionMutationDetails.actionId} = ${actionLedgerEntries.id}
      AND ${condition}
  )`
}

function sensitiveReadDetailExists(condition: SQL): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${actionSensitiveReadDetails}
    WHERE ${actionSensitiveReadDetails.actionId} = ${actionLedgerEntries.id}
      AND ${condition}
  )`
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

function buildApprovalCursorCondition(cursor: ActionApprovalListCursor): SQL {
  const createdAt = parseCursorDate(cursor.createdAt)
  const tieBreaker = and(
    eq(actionApprovals.createdAt, createdAt),
    lt(actionApprovals.id, cursor.id),
  )

  return or(lt(actionApprovals.createdAt, createdAt), tieBreaker) as SQL
}

function buildDelegationCursorCondition(cursor: ActionDelegationListCursor): SQL {
  const createdAt = parseCursorDate(cursor.createdAt)
  const tieBreaker = and(
    eq(actionDelegations.createdAt, createdAt),
    lt(actionDelegations.id, cursor.id),
  )

  return or(lt(actionDelegations.createdAt, createdAt), tieBreaker) as SQL
}

function buildActionDelegationsPredicate(input: ListActionDelegationsInput): SQL | undefined {
  const conditions: SQL[] = []

  if (input.rootPrincipalType) {
    conditions.push(eq(actionDelegations.rootPrincipalType, input.rootPrincipalType))
  }
  if (input.rootPrincipalId) {
    conditions.push(eq(actionDelegations.rootPrincipalId, input.rootPrincipalId))
  }
  if (input.parentPrincipalType) {
    conditions.push(eq(actionDelegations.parentPrincipalType, input.parentPrincipalType))
  }
  if (input.parentPrincipalId) {
    conditions.push(eq(actionDelegations.parentPrincipalId, input.parentPrincipalId))
  }
  if (input.childPrincipalType) {
    conditions.push(eq(actionDelegations.childPrincipalType, input.childPrincipalType))
  }
  if (input.childPrincipalId) {
    conditions.push(eq(actionDelegations.childPrincipalId, input.childPrincipalId))
  }
  if (input.grantSource) conditions.push(eq(actionDelegations.grantSource, input.grantSource))
  if (input.capabilityScopeRef) {
    conditions.push(eq(actionDelegations.capabilityScopeRef, input.capabilityScopeRef))
  }
  if (input.budgetScopeRef) {
    conditions.push(eq(actionDelegations.budgetScopeRef, input.budgetScopeRef))
  }

  if (input.expiresAtFrom) {
    conditions.push(gte(actionDelegations.expiresAt, parseCursorDate(input.expiresAtFrom)))
  }
  if (input.expiresAtTo) {
    conditions.push(lte(actionDelegations.expiresAt, parseCursorDate(input.expiresAtTo)))
  }
  if (input.createdAtFrom) {
    conditions.push(gte(actionDelegations.createdAt, parseCursorDate(input.createdAtFrom)))
  }
  if (input.createdAtTo) {
    conditions.push(lte(actionDelegations.createdAt, parseCursorDate(input.createdAtTo)))
  }

  if (input.cursor) {
    conditions.push(buildDelegationCursorCondition(input.cursor))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

function buildActionApprovalsPredicate(input: ListActionApprovalsInput): SQL | undefined {
  const conditions: SQL[] = []

  if (input.requestedActionId) {
    conditions.push(eq(actionApprovals.requestedActionId, input.requestedActionId))
  }

  const entryStatusCondition = approvalStatusCondition(input.status)
  if (entryStatusCondition) conditions.push(entryStatusCondition)

  if (input.requestedByPrincipalId) {
    conditions.push(eq(actionApprovals.requestedByPrincipalId, input.requestedByPrincipalId))
  }
  if (input.assignedToPrincipalId) {
    conditions.push(eq(actionApprovals.assignedToPrincipalId, input.assignedToPrincipalId))
  }
  if (input.decidedByPrincipalId) {
    conditions.push(eq(actionApprovals.decidedByPrincipalId, input.decidedByPrincipalId))
  }
  if (input.delegatedFromPrincipalId) {
    conditions.push(eq(actionApprovals.delegatedFromPrincipalId, input.delegatedFromPrincipalId))
  }
  if (input.policyName) conditions.push(eq(actionApprovals.policyName, input.policyName))
  if (input.policyVersion) conditions.push(eq(actionApprovals.policyVersion, input.policyVersion))

  const riskSnapshotCondition = approvalRiskCondition(input.riskSnapshot)
  if (riskSnapshotCondition) conditions.push(riskSnapshotCondition)

  if (input.reasonCode) conditions.push(eq(actionApprovals.reasonCode, input.reasonCode))

  if (input.expiresAtFrom) {
    conditions.push(gte(actionApprovals.expiresAt, parseCursorDate(input.expiresAtFrom)))
  }
  if (input.expiresAtTo) {
    conditions.push(lte(actionApprovals.expiresAt, parseCursorDate(input.expiresAtTo)))
  }
  if (input.decidedAtFrom) {
    conditions.push(gte(actionApprovals.decidedAt, parseCursorDate(input.decidedAtFrom)))
  }
  if (input.decidedAtTo) {
    conditions.push(lte(actionApprovals.decidedAt, parseCursorDate(input.decidedAtTo)))
  }
  if (input.createdAtFrom) {
    conditions.push(gte(actionApprovals.createdAt, parseCursorDate(input.createdAtFrom)))
  }
  if (input.createdAtTo) {
    conditions.push(lte(actionApprovals.createdAt, parseCursorDate(input.createdAtTo)))
  }

  if (input.cursor) {
    conditions.push(buildApprovalCursorCondition(input.cursor))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
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

  if (input.createdAtFrom) {
    conditions.push(gte(actionLedgerRelayOutbox.createdAt, parseCursorDate(input.createdAtFrom)))
  }
  if (input.createdAtTo) {
    conditions.push(lte(actionLedgerRelayOutbox.createdAt, parseCursorDate(input.createdAtTo)))
  }
  if (input.processedAtFrom) {
    conditions.push(
      gte(actionLedgerRelayOutbox.processedAt, parseCursorDate(input.processedAtFrom)),
    )
  }
  if (input.processedAtTo) {
    conditions.push(lte(actionLedgerRelayOutbox.processedAt, parseCursorDate(input.processedAtTo)))
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

  const entryReversalKindCondition = reversalKindCondition(input.reversalKind)
  if (entryReversalKindCondition) {
    conditions.push(mutationDetailExists(entryReversalKindCondition))
  }

  const entryReversalStateCondition = reversalStateCondition(input.reversalState)
  if (entryReversalStateCondition) {
    conditions.push(mutationDetailExists(entryReversalStateCondition))
  }

  const entryReversalOutcomeCondition = reversalOutcomeCondition(input.reversalOutcome)
  if (entryReversalOutcomeCondition) {
    conditions.push(mutationDetailExists(entryReversalOutcomeCondition))
  }

  if (input.reversesActionId) {
    conditions.push(
      mutationDetailExists(eq(actionMutationDetails.reversesActionId, input.reversesActionId)),
    )
  }
  if (input.reversedByActionId) {
    conditions.push(
      mutationDetailExists(
        eq(actionMutationDetails.reversedByActionIdProjection, input.reversedByActionId),
      ),
    )
  }
  if (input.sensitiveReasonCode) {
    conditions.push(
      sensitiveReadDetailExists(
        eq(actionSensitiveReadDetails.reasonCode, input.sensitiveReasonCode),
      ),
    )
  }
  if (input.decisionPolicy) {
    conditions.push(
      sensitiveReadDetailExists(
        eq(actionSensitiveReadDetails.decisionPolicy, input.decisionPolicy),
      ),
    )
  }

  if (input.occurredAtFrom) {
    conditions.push(gte(actionLedgerEntries.occurredAt, parseCursorDate(input.occurredAtFrom)))
  }
  if (input.occurredAtTo) {
    conditions.push(lte(actionLedgerEntries.occurredAt, parseCursorDate(input.occurredAtTo)))
  }

  if (input.cursor) {
    conditions.push(buildCursorCondition(input.cursor))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

export const __test__ = {
  buildActionApprovalsPredicate,
  buildActionDelegationsPredicate,
  buildActionLedgerEntriesPredicate,
  buildActionLedgerRelayOutboxPredicate,
  normalizeListLimit,
  toActionApprovalListCursor,
  toActionDelegationListCursor,
  toActionLedgerListCursor,
  toActionLedgerRelayOutboxListCursor,
}
