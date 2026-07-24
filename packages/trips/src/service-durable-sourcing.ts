// agent-quality: file-size exception -- owner: trips; command admission, immutable replay, leases, fan-out settlement, and failure recovery intentionally share one durable operation protocol.
import {
  type ActionLedgerRequestContextValues,
  type AdmittedExistingTargetCommand,
  type ExistingTargetCommandPayload,
  executeAdmittedExistingTargetCommand,
} from "@voyant-travel/action-ledger"
import type { FanOutAvailabilityResult } from "@voyant-travel/catalog"
import type { AvailabilitySearchRequest } from "@voyant-travel/catalog-contracts"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type TripRequirement,
  type TripRequirementSourcingOperation,
  tripCandidates,
  tripRequirementSourcingOperations,
  tripRequirements,
} from "./schema.js"
import {
  availabilityCandidateToRow,
  type SourceRequirementCandidatesDeps,
  type SourceRequirementCandidatesInput,
} from "./service-requirements.js"
import { TripsInvariantError } from "./service-types.js"

export const TRIP_REQUIREMENT_SOURCING_REQUESTED_EVENT = "trip.requirement-sourcing-requested"
export const TRIP_REQUIREMENT_SOURCING_COMPLETED_EVENT = "trip.requirement-sourcing-completed"
export const TRIP_REQUIREMENT_SOURCING_DEAD_LETTERED_EVENT =
  "trip.requirement-sourcing-dead-lettered"

const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_VISIBILITY_TIMEOUT_MS = 2 * 60_000
const DEFAULT_RETRY_BASE_MS = 5_000
export const TRIP_REQUIREMENT_SOURCING_STATUS_TOOL =
  "get_trip_requirement_sourcing_operation" as const

export interface SourceTripCandidatesAcceptedResult extends Record<string, unknown> {
  status: "accepted"
  operationId: string
  requirementId: string
  statusTool: typeof TRIP_REQUIREMENT_SOURCING_STATUS_TOOL
}

export type TripRequirementSourcingOutcome =
  | {
      status: "completed"
      candidateCount: number
      requirementStatus: "candidates_ready" | "no_availability"
    }
  | { status: "dead_letter"; error: string }

export interface TripRequirementSourcingOperationView {
  operationId: string
  requirementId: string
  status: TripRequirementSourcingOperation["status"]
  result: SourceTripCandidatesAcceptedResult
  outcome: TripRequirementSourcingOutcome | null
  error: string | null
  attempts: number
  maxAttempts: number
  nextAttemptAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface SourcingRequestSnapshot extends Record<string, unknown> {
  requirementId: string
  envelopeId: string
  vertical: string
  criteria: Record<string, unknown>
  criteriaVersion: string
  scope: SourceRequirementCandidatesInput["scope"]
  deadlineMs?: number
  limit?: number
}

export interface ExecuteDurableTripRequirementSourcingInput {
  db: AnyDrizzleDb
  context: ActionLedgerRequestContextValues
  admitted: ToolHandlerActionPolicyContext
  input: SourceRequirementCandidatesInput
  testHooks?: {
    afterPrepare?: (tx: AnyDrizzleDb, operationId: string) => Promise<void>
  }
}

/**
 * Admit one sourcing command and atomically record its immutable request,
 * accepted Tool result, and requested outbox event. Provider code never runs
 * on the request path.
 */
export async function executeDurableTripRequirementSourcingCommand(
  input: ExecuteDurableTripRequirementSourcingInput,
) {
  return executeAdmittedExistingTargetCommand(
    {
      db: input.db,
      context: input.context,
      admitted: input.admitted,
      commandInput: input.input,
      evaluatedRisk: "medium",
    },
    {
      async prepare(tx, command, payload) {
        await prepareDurableSourcing(tx, command, payload)
        await input.testHooks?.afterPrepare?.(tx, command.causation.claimActionId)
      },
      execute: (command) => resolveAcceptedResult(input.db, command),
      replay: (command) => resolveAcceptedResult(input.db, command),
    },
  )
}

async function prepareDurableSourcing(
  tx: AnyDrizzleDb,
  command: AdmittedExistingTargetCommand,
  input: ExistingTargetCommandPayload<SourceRequirementCandidatesInput>,
): Promise<void> {
  const [requirement] = (await tx
    .select()
    .from(tripRequirements)
    .where(eq(tripRequirements.id, input.requirementId))
    .for("update")
    .limit(1)) as TripRequirement[]
  if (!requirement) {
    throw new TripsInvariantError(`Trip requirement ${input.requirementId} was not found`)
  }
  if (command.target.id !== requirement.id || command.target.type !== "trip-requirement") {
    throw new TripsInvariantError("Sourcing command target does not match its trip requirement")
  }
  if (requirement.status === "selected" || requirement.status === "cancelled") {
    throw new TripsInvariantError(
      `Trip requirement ${requirement.id} is ${requirement.status} and cannot be sourced`,
    )
  }

  const active = await tx
    .select({ id: tripRequirementSourcingOperations.id })
    .from(tripRequirementSourcingOperations)
    .where(
      and(
        eq(tripRequirementSourcingOperations.requirementId, requirement.id),
        inArray(tripRequirementSourcingOperations.status, ["pending", "processing", "retry"]),
      ),
    )
    .limit(1)
  if (active.length > 0) {
    throw new TripsInvariantError(
      `Trip requirement ${requirement.id} already has an active sourcing operation`,
    )
  }
  let previousRequirementStatus = requirement.status
  if (previousRequirementStatus === "sourcing") {
    const ranked = await tx
      .select({ id: tripCandidates.id })
      .from(tripCandidates)
      .where(
        and(eq(tripCandidates.requirementId, requirement.id), eq(tripCandidates.status, "ranked")),
      )
      .limit(1)
    previousRequirementStatus =
      ranked.length > 0
        ? "candidates_ready"
        : requirement.lastSourcedAt
          ? "no_availability"
          : "open"
  }

  const requestSnapshot: SourcingRequestSnapshot = {
    requirementId: requirement.id,
    envelopeId: requirement.envelopeId,
    vertical: requirement.vertical,
    criteria: requirement.criteria,
    criteriaVersion: requirement.criteriaVersion,
    scope: input.scope,
    ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
  }
  const resultSnapshot: SourceTripCandidatesAcceptedResult = {
    status: "accepted",
    operationId: command.causation.claimActionId,
    requirementId: requirement.id,
    statusTool: TRIP_REQUIREMENT_SOURCING_STATUS_TOOL,
  }
  await tx.insert(tripRequirementSourcingOperations).values({
    id: command.causation.claimActionId,
    commandScope: command.idempotency.scope,
    idempotencyKey: command.idempotency.key,
    requestFingerprint: command.idempotency.fingerprint,
    organizationId: command.authorization.organizationId,
    targetType: command.target.type,
    targetId: command.target.id,
    requirementId: requirement.id,
    previousRequirementStatus,
    requestSnapshot,
    resultSnapshot,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  })
  await tx
    .update(tripRequirements)
    .set({ status: "sourcing", updatedAt: new Date() })
    .where(eq(tripRequirements.id, requirement.id))
  await insertOutboxEvents(tx, [
    {
      name: TRIP_REQUIREMENT_SOURCING_REQUESTED_EVENT,
      data: {
        operationId: command.causation.claimActionId,
        requirementId: requirement.id,
        envelopeId: requirement.envelopeId,
      },
      metadata: {
        category: "domain",
        source: "service",
        eventId: requestedEventId(command.causation.claimActionId),
        correlationId: command.causation.claimActionId,
      },
    },
  ])
}

async function resolveAcceptedResult(
  db: AnyDrizzleDb,
  command: AdmittedExistingTargetCommand,
): Promise<SourceTripCandidatesAcceptedResult> {
  const [operation] = await db
    .select()
    .from(tripRequirementSourcingOperations)
    .where(
      and(
        eq(tripRequirementSourcingOperations.commandScope, command.idempotency.scope),
        eq(tripRequirementSourcingOperations.idempotencyKey, command.idempotency.key),
      ),
    )
    .limit(1)
  if (
    !operation ||
    operation.id !== command.causation.claimActionId ||
    operation.requestFingerprint !== command.idempotency.fingerprint ||
    operation.targetType !== command.target.type ||
    operation.targetId !== command.target.id ||
    operation.organizationId !== command.authorization.organizationId
  ) {
    throw new TripsInvariantError("Durable sourcing command state is missing or inconsistent")
  }
  return acceptedResult(operation.resultSnapshot)
}

/**
 * Read one durable operation without leaking its existence across organization
 * or requirement boundaries. The accepted result remains immutable while
 * outcome/error make terminal success and failure unambiguous.
 */
export async function getTripRequirementSourcingOperation(
  db: AnyDrizzleDb,
  input: {
    operationId: string
    requirementId: string
    organizationId: string | null
  },
): Promise<TripRequirementSourcingOperationView | null> {
  const organizationPredicate =
    input.organizationId === null
      ? isNull(tripRequirementSourcingOperations.organizationId)
      : eq(tripRequirementSourcingOperations.organizationId, input.organizationId)
  const [operation] = await db
    .select()
    .from(tripRequirementSourcingOperations)
    .where(
      and(
        eq(tripRequirementSourcingOperations.id, input.operationId),
        eq(tripRequirementSourcingOperations.requirementId, input.requirementId),
        eq(tripRequirementSourcingOperations.targetType, "trip-requirement"),
        eq(tripRequirementSourcingOperations.targetId, input.requirementId),
        organizationPredicate,
      ),
    )
    .limit(1)
  if (!operation) return null
  return {
    operationId: operation.id,
    requirementId: operation.requirementId,
    status: operation.status,
    result: acceptedResult(operation.resultSnapshot),
    outcome: operation.outcomeSnapshot ? sourcingOutcome(operation.outcomeSnapshot) : null,
    error: operation.lastError,
    attempts: operation.attempts,
    maxAttempts: operation.maxAttempts,
    nextAttemptAt: operation.nextAttemptAt,
    completedAt: operation.completedAt,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  }
}

export interface DrainTripRequirementSourcingOptions {
  limit?: number
  now?: Date
  visibilityTimeoutMs?: number
  retryBaseMs?: number
  testHooks?: {
    afterSearch?: (
      operation: TripRequirementSourcingOperation,
      result: FanOutAvailabilityResult,
    ) => Promise<void>
    beforeCompletionEvent?: (
      tx: AnyDrizzleDb,
      operation: TripRequirementSourcingOperation,
    ) => Promise<void>
  }
}

export interface DrainTripRequirementSourcingResult {
  claimed: number
  completed: number
  retried: number
  deadLettered: number
  leaseLost: number
}

/**
 * Claim due operations, execute read-only provider fan-out outside a database
 * transaction, then atomically replace candidates and settle the operation.
 */
export async function drainTripRequirementSourcing(
  db: PostgresJsDatabase,
  deps: SourceRequirementCandidatesDeps,
  options: DrainTripRequirementSourcingOptions = {},
): Promise<DrainTripRequirementSourcingResult> {
  const now = options.now ?? new Date()
  const exhausted = await deadLetterExhaustedExpiredOperations(
    db,
    now,
    Math.max(1, Math.min(options.limit ?? 25, 100)),
  )
  const operations = await claimSourcingOperations(db, {
    limit: options.limit,
    now,
    visibilityTimeoutMs: options.visibilityTimeoutMs,
  })
  const summary: DrainTripRequirementSourcingResult = {
    claimed: operations.length,
    completed: 0,
    retried: 0,
    deadLettered: exhausted,
    leaseLost: 0,
  }

  for (const operation of operations) {
    try {
      const request = searchRequest(operation.requestSnapshot)
      const result = await deps.search(request)
      assertUsableSearchResult(result)
      await options.testHooks?.afterSearch?.(operation, result)
      const settled = await settleSourcingOperation(
        db,
        operation,
        result,
        now,
        options.testHooks?.beforeCompletionEvent,
      )
      if (settled) summary.completed += 1
      else summary.leaseLost += 1
    } catch (error) {
      const terminal = operation.attempts >= operation.maxAttempts
      const transitioned = await failSourcingOperation(
        db,
        operation,
        errorMessage(error),
        now,
        options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
        terminal,
      )
      if (!transitioned) summary.leaseLost += 1
      else if (terminal) summary.deadLettered += 1
      else summary.retried += 1
    }
  }
  return summary
}

/**
 * A process may disappear after claiming its final allowed attempt. Sweep that
 * expired lease to dead-letter without crossing the provider boundary again.
 */
async function deadLetterExhaustedExpiredOperations(
  db: PostgresJsDatabase,
  now: Date,
  limit: number,
): Promise<number> {
  const nowIso = now.toISOString()
  return db.transaction(async (tx) => {
    // agent-quality: raw-sql reviewed -- owner: trips; this bounded SKIP LOCKED
    // sweep terminally fences final-attempt leases abandoned by a dead worker.
    const raw = await tx.execute(sql`
      UPDATE trip_requirement_sourcing_operations
      SET
        status = 'dead_letter',
        lease_expires_at = NULL,
        last_error = 'worker lease expired after the final attempt',
        outcome_snapshot = jsonb_build_object(
          'status', 'dead_letter',
          'error', 'worker lease expired after the final attempt'
        ),
        completed_at = ${nowIso}::timestamptz,
        updated_at = ${nowIso}::timestamptz
      WHERE id IN (
        SELECT id
        FROM trip_requirement_sourcing_operations
        WHERE status = 'processing'
          AND attempts >= max_attempts
          AND lease_expires_at <= ${nowIso}::timestamptz
        ORDER BY lease_expires_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING *
    `)
    const operations = resultRows<Record<string, unknown>>(raw).map(normalizeOperation)
    for (const operation of operations) {
      await tx
        .update(tripRequirements)
        .set({ status: operation.previousRequirementStatus, updatedAt: now })
        .where(
          and(
            eq(tripRequirements.id, operation.requirementId),
            eq(tripRequirements.status, "sourcing"),
          ),
        )
    }
    if (operations.length > 0) {
      await insertOutboxEvents(
        tx,
        operations.map((operation) => ({
          name: TRIP_REQUIREMENT_SOURCING_DEAD_LETTERED_EVENT,
          data: {
            operationId: operation.id,
            requirementId: operation.requirementId,
            attempts: operation.attempts,
            error: operation.lastError,
          },
          metadata: {
            category: "domain" as const,
            source: "service" as const,
            eventId: deadLetteredEventId(operation.id),
            correlationId: operation.id,
          },
        })),
      )
    }
    return operations.length
  })
}

async function claimSourcingOperations(
  db: PostgresJsDatabase,
  options: Pick<DrainTripRequirementSourcingOptions, "limit" | "now" | "visibilityTimeoutMs">,
): Promise<TripRequirementSourcingOperation[]> {
  const now = options.now ?? new Date()
  const leaseExpiresAt = new Date(
    now.getTime() + (options.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS),
  )
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100))
  const nowIso = now.toISOString()
  const leaseExpiresAtIso = leaseExpiresAt.toISOString()
  // agent-quality: raw-sql reviewed -- owner: trips; fixed identifiers and bound
  // values implement one atomic, version-fenced SKIP LOCKED lease claim.
  const raw = await db.execute(sql`
    UPDATE trip_requirement_sourcing_operations
    SET
      status = 'processing',
      attempts = attempts + 1,
      lease_expires_at = ${leaseExpiresAtIso}::timestamptz,
      lease_version = lease_version + 1,
      updated_at = ${nowIso}::timestamptz
    WHERE id IN (
      SELECT id
      FROM trip_requirement_sourcing_operations
      WHERE attempts < max_attempts
        AND (
          (status IN ('pending', 'retry') AND next_attempt_at <= ${nowIso}::timestamptz)
          OR (status = 'processing' AND lease_expires_at <= ${nowIso}::timestamptz)
        )
      ORDER BY next_attempt_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *
  `)
  return resultRows<Record<string, unknown>>(raw).map(normalizeOperation)
}

async function settleSourcingOperation(
  db: PostgresJsDatabase,
  operation: TripRequirementSourcingOperation,
  result: FanOutAvailabilityResult,
  now: Date,
  beforeCompletionEvent:
    | ((tx: AnyDrizzleDb, operation: TripRequirementSourcingOperation) => Promise<void>)
    | undefined,
): Promise<boolean> {
  const request = sourcingSnapshot(operation.requestSnapshot)
  const candidateRows = result.candidates.map((candidate, rank) =>
    availabilityCandidateToRow({
      requirementId: operation.requirementId,
      envelopeId: request.envelopeId,
      candidate,
      rank,
    }),
  )
  const requirementStatus = candidateRows.length > 0 ? "candidates_ready" : "no_availability"
  const outcomeSnapshot: TripRequirementSourcingOutcome = {
    status: "completed",
    candidateCount: candidateRows.length,
    requirementStatus,
  }
  return db.transaction(async (tx) => {
    const transitioned = await tx
      .update(tripRequirementSourcingOperations)
      .set({
        status: "completed",
        leaseExpiresAt: null,
        lastError: null,
        outcomeSnapshot,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tripRequirementSourcingOperations.id, operation.id),
          eq(tripRequirementSourcingOperations.status, "processing"),
          eq(tripRequirementSourcingOperations.leaseVersion, operation.leaseVersion),
        ),
      )
      .returning({ id: tripRequirementSourcingOperations.id })
    if (transitioned.length !== 1) return false

    const [requirement] = (await tx
      .select()
      .from(tripRequirements)
      .where(eq(tripRequirements.id, operation.requirementId))
      .for("update")
      .limit(1)) as TripRequirement[]
    if (
      !requirement ||
      requirement.id !== request.requirementId ||
      requirement.envelopeId !== request.envelopeId ||
      requirement.vertical !== request.vertical ||
      requirement.criteriaVersion !== request.criteriaVersion ||
      JSON.stringify(requirement.criteria) !== JSON.stringify(request.criteria) ||
      requirement.status !== "sourcing" ||
      requirement.selectedCandidateId !== null ||
      requirement.resolvedComponentId !== null
    ) {
      throw new TripsInvariantError(
        `Trip requirement ${operation.requirementId} changed while sourcing`,
      )
    }

    await tx
      .update(tripCandidates)
      .set({ status: "discarded", updatedAt: now })
      .where(
        and(
          eq(tripCandidates.requirementId, operation.requirementId),
          eq(tripCandidates.status, "ranked"),
        ),
      )
    if (candidateRows.length > 0) {
      await tx.insert(tripCandidates).values(candidateRows)
    }
    await tx
      .update(tripRequirements)
      .set({ status: requirementStatus, lastSourcedAt: now, updatedAt: now })
      .where(eq(tripRequirements.id, operation.requirementId))
    await beforeCompletionEvent?.(tx, operation)
    await insertOutboxEvents(tx, [
      {
        name: TRIP_REQUIREMENT_SOURCING_COMPLETED_EVENT,
        data: {
          operationId: operation.id,
          requirementId: operation.requirementId,
          envelopeId: request.envelopeId,
          candidateCount: candidateRows.length,
          status: requirementStatus,
        },
        metadata: {
          category: "domain",
          source: "service",
          eventId: completedEventId(operation.id),
          correlationId: operation.id,
        },
      },
    ])
    return true
  })
}

async function failSourcingOperation(
  db: PostgresJsDatabase,
  operation: TripRequirementSourcingOperation,
  message: string,
  now: Date,
  retryBaseMs: number,
  terminal: boolean,
): Promise<boolean> {
  const lastError = message.slice(0, 2_000)
  const nextAttemptAt = new Date(
    now.getTime() + Math.min(retryBaseMs * 2 ** Math.max(0, operation.attempts - 1), 15 * 60_000),
  )
  return db.transaction(async (tx) => {
    const transitioned = await tx
      .update(tripRequirementSourcingOperations)
      .set({
        status: terminal ? "dead_letter" : "retry",
        leaseExpiresAt: null,
        lastError,
        outcomeSnapshot: terminal
          ? ({ status: "dead_letter", error: lastError } satisfies TripRequirementSourcingOutcome)
          : null,
        nextAttemptAt,
        completedAt: terminal ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(tripRequirementSourcingOperations.id, operation.id),
          eq(tripRequirementSourcingOperations.status, "processing"),
          eq(tripRequirementSourcingOperations.leaseVersion, operation.leaseVersion),
        ),
      )
      .returning({ id: tripRequirementSourcingOperations.id })
    if (transitioned.length !== 1) return false
    if (!terminal) return true

    await tx
      .update(tripRequirements)
      .set({ status: operation.previousRequirementStatus, updatedAt: now })
      .where(
        and(
          eq(tripRequirements.id, operation.requirementId),
          eq(tripRequirements.status, "sourcing"),
        ),
      )
    await insertOutboxEvents(tx, [
      {
        name: TRIP_REQUIREMENT_SOURCING_DEAD_LETTERED_EVENT,
        data: {
          operationId: operation.id,
          requirementId: operation.requirementId,
          attempts: operation.attempts,
          error: lastError,
        },
        metadata: {
          category: "domain",
          source: "service",
          eventId: deadLetteredEventId(operation.id),
          correlationId: operation.id,
        },
      },
    ])
    return true
  })
}

function searchRequest(value: Record<string, unknown>): AvailabilitySearchRequest {
  const snapshot = sourcingSnapshot(value)
  return {
    vertical: snapshot.vertical,
    criteria: snapshot.criteria,
    criteriaVersion: snapshot.criteriaVersion,
    scope: snapshot.scope,
    ...(snapshot.deadlineMs === undefined ? {} : { deadlineMs: snapshot.deadlineMs }),
    ...(snapshot.limit === undefined ? {} : { limit: snapshot.limit }),
  }
}

function sourcingSnapshot(value: Record<string, unknown>): SourcingRequestSnapshot {
  if (
    typeof value.requirementId !== "string" ||
    typeof value.envelopeId !== "string" ||
    typeof value.vertical !== "string" ||
    !isRecord(value.criteria) ||
    typeof value.criteriaVersion !== "string" ||
    !isRecord(value.scope)
  ) {
    throw new TripsInvariantError("Durable sourcing request snapshot is invalid")
  }
  return value as unknown as SourcingRequestSnapshot
}

function acceptedResult(value: Record<string, unknown>): SourceTripCandidatesAcceptedResult {
  if (
    value.status !== "accepted" ||
    typeof value.operationId !== "string" ||
    typeof value.requirementId !== "string" ||
    value.statusTool !== TRIP_REQUIREMENT_SOURCING_STATUS_TOOL
  ) {
    throw new TripsInvariantError("Durable sourcing result snapshot is invalid")
  }
  return value as unknown as SourceTripCandidatesAcceptedResult
}

function sourcingOutcome(value: Record<string, unknown>): TripRequirementSourcingOutcome {
  if (
    value.status === "completed" &&
    typeof value.candidateCount === "number" &&
    (value.requirementStatus === "candidates_ready" ||
      value.requirementStatus === "no_availability")
  ) {
    return value as unknown as TripRequirementSourcingOutcome
  }
  if (value.status === "dead_letter" && typeof value.error === "string") {
    return value as unknown as TripRequirementSourcingOutcome
  }
  throw new TripsInvariantError("Durable sourcing outcome snapshot is invalid")
}

function assertUsableSearchResult(result: FanOutAvailabilityResult): void {
  if (!result || !Array.isArray(result.candidates) || !Array.isArray(result.perConnection)) {
    throw new TripsInvariantError("Availability fan-out returned an invalid result")
  }
  const successfulSource = result.perConnection.some((entry) =>
    ["ok", "partial", "empty"].includes(entry.status),
  )
  if (!successfulSource) {
    throw new TripsInvariantError(
      "Availability fan-out had no successful eligible source; existing candidates were retained",
    )
  }
  if (
    result.candidates.length === 0 &&
    result.perConnection.some(
      (entry) => entry.status !== "empty" && entry.status !== "vertical_skipped",
    )
  ) {
    throw new TripsInvariantError(
      "Availability fan-out was not authoritative for no-availability; existing candidates were retained",
    )
  }
}

function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows
    if (Array.isArray(rows)) return rows as T[]
  }
  return []
}

function normalizeOperation(row: Record<string, unknown>): TripRequirementSourcingOperation {
  return {
    id: row.id,
    commandScope: row.command_scope ?? row.commandScope,
    idempotencyKey: row.idempotency_key ?? row.idempotencyKey,
    requestFingerprint: row.request_fingerprint ?? row.requestFingerprint,
    organizationId: row.organization_id ?? row.organizationId ?? null,
    targetType: row.target_type ?? row.targetType,
    targetId: row.target_id ?? row.targetId,
    requirementId: row.requirement_id ?? row.requirementId,
    previousRequirementStatus: row.previous_requirement_status ?? row.previousRequirementStatus,
    requestSnapshot: row.request_snapshot ?? row.requestSnapshot,
    resultSnapshot: row.result_snapshot ?? row.resultSnapshot,
    outcomeSnapshot: row.outcome_snapshot ?? row.outcomeSnapshot ?? null,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts ?? row.maxAttempts,
    nextAttemptAt: coerceDate(row.next_attempt_at ?? row.nextAttemptAt),
    leaseExpiresAt:
      (row.lease_expires_at ?? row.leaseExpiresAt) == null
        ? null
        : coerceDate(row.lease_expires_at ?? row.leaseExpiresAt),
    leaseVersion: row.lease_version ?? row.leaseVersion,
    lastError: row.last_error ?? row.lastError ?? null,
    completedAt:
      (row.completed_at ?? row.completedAt) == null
        ? null
        : coerceDate(row.completed_at ?? row.completedAt),
    createdAt: coerceDate(row.created_at ?? row.createdAt),
    updatedAt: coerceDate(row.updated_at ?? row.updatedAt),
  } as TripRequirementSourcingOperation
}

function coerceDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function requestedEventId(operationId: string): string {
  return `evt_trip_requirement_sourcing_requested_${operationId}`
}

export function completedEventId(operationId: string): string {
  return `evt_trip_requirement_sourcing_completed_${operationId}`
}

export function deadLetteredEventId(operationId: string): string {
  return `evt_trip_requirement_sourcing_dead_lettered_${operationId}`
}
