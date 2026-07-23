// agent-quality: file-size exception -- owner: action-ledger; claim, replay validation, and canonical completion form one transactional state machine.
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, sql } from "drizzle-orm"

import { buildIdempotencyFingerprint } from "./fingerprint.js"
import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildActionLedgerMutationEntryInput,
} from "./request-context.js"
import {
  type ActionLedgerEntry,
  actionLedgerEntries,
  actionMutationDetails,
} from "./schema.js"
import { insertEntry } from "./service/entries.js"
import { ActionLedgerIdempotencyConflictError } from "./service/errors.js"
import type { AppendActionLedgerEntryInput } from "./service/types.js"

const CLAIM_SCOPE_SUFFIX = ":created-command-claim"
const RESULT_SCOPE_SUFFIX = ":created-command-result"

export type CreatedTargetCommandResultReference<TReferenceType extends string = string> =
  `${TReferenceType}:${string}`

export type ActionLedgerCreatedCommandReplayCorruptReason =
  | "malformed_result_reference"
  | "wrong_result_reference_type"
  | "result_target_id_mismatch"
  | "result_target_type_mismatch"
  | "result_action_mismatch"
  | "result_fingerprint_mismatch"

export class ActionLedgerCreatedCommandReplayIncompleteError extends Error {
  readonly claimActionId: string

  constructor(claimActionId: string) {
    super(`Created-target command claim ${claimActionId} has no canonical succeeded result`)
    this.name = "ActionLedgerCreatedCommandReplayIncompleteError"
    this.claimActionId = claimActionId
  }
}

export class ActionLedgerCreatedCommandReplayCorruptError extends Error {
  readonly claimActionId: string
  readonly resultActionId: string
  readonly reason: ActionLedgerCreatedCommandReplayCorruptReason

  constructor(
    claimActionId: string,
    resultActionId: string,
    reason: ActionLedgerCreatedCommandReplayCorruptReason,
  ) {
    super(
      `Created-target command result ${resultActionId} for claim ${claimActionId} is invalid: ${reason}`,
    )
    this.name = "ActionLedgerCreatedCommandReplayCorruptError"
    this.claimActionId = claimActionId
    this.resultActionId = resultActionId
    this.reason = reason
  }
}

export class ActionLedgerCreatedCommandFingerprintMismatchError extends Error {
  readonly expectedFingerprint: string
  readonly receivedFingerprint: string

  constructor(expectedFingerprint: string, receivedFingerprint: string) {
    super(
      "Created-target command fingerprint does not cover its command, target, result-reference, and policy metadata",
    )
    this.name = "ActionLedgerCreatedCommandFingerprintMismatchError"
    this.expectedFingerprint = expectedFingerprint
    this.receivedFingerprint = receivedFingerprint
  }
}

export interface BuildCreatedTargetCommandFingerprintInput {
  actionName: string
  actionVersion: string
  commandTarget: {
    type: string
    id: string
  }
  canonicalTargetType: string
  resultReferenceType: string
  commandInput?: unknown
  policyInputs: Record<string, unknown>
}

type CreatedCommandCommonInput = Omit<
  BuildActionLedgerMutationInput,
  | "actionKind"
  | "status"
  | "targetType"
  | "targetId"
  | "idempotencyScope"
  | "idempotencyKey"
  | "idempotencyFingerprint"
  | "mutationDetail"
>

export interface ClaimCreatedTargetCommandInput extends CreatedCommandCommonInput {
  context: ActionLedgerRequestContextValues
  actionKind?: Extract<ActionLedgerEntry["actionKind"], "create" | "execute">
  commandTarget: {
    type: string
    id: string
  }
  canonicalTargetType: string
  resultReferenceType: string
  idempotency: {
    scope: string
    key: string
    fingerprint: string
  }
  fingerprintInput: {
    commandInput?: unknown
    policyInputs: Record<string, unknown>
  }
  mutationDetail?: Omit<
    NonNullable<BuildActionLedgerMutationInput["mutationDetail"]>,
    "commandResultRef"
  >
}

export interface CreatedTargetCommandResultMetadata<TReferenceType extends string = string> {
  entry: ActionLedgerEntry
  reference: {
    type: TReferenceType
    id: string
    value: CreatedTargetCommandResultReference<TReferenceType>
  }
}

export interface CreatedTargetCommandClaim<TReferenceType extends string = string> {
  entry: ActionLedgerEntry
  canonicalTargetType: string
  resultReferenceType: TReferenceType
  idempotency: {
    scope: string
    key: string
    fingerprint: string
  }
}

export type ClaimCreatedTargetCommandResult<TReferenceType extends string = string> =
  | {
      claim: CreatedTargetCommandClaim<TReferenceType>
      replayed: false
      result: null
    }
  | {
      claim: CreatedTargetCommandClaim<TReferenceType>
      replayed: true
      result: CreatedTargetCommandResultMetadata<TReferenceType>
    }

export interface CompleteCreatedTargetCommandInput<TReferenceType extends string = string> {
  claim: CreatedTargetCommandClaim<TReferenceType>
  targetId: string
  mutationDetail?: Omit<
    NonNullable<BuildActionLedgerMutationInput["mutationDetail"]>,
    "commandResultRef"
  >
  payloads?: AppendActionLedgerEntryInput["payloads"]
}

export interface CompleteCreatedTargetCommandResult<TReferenceType extends string = string>
  extends CreatedTargetCommandResultMetadata<TReferenceType> {
  replayed: boolean
}

/**
 * Claims a created-target command before its domain mutation.
 *
 * The caller must pass the same open transaction handle to this helper, the
 * domain mutation, and `completeCreatedTargetCommand`. The transaction-scoped
 * advisory lock serializes equal `(scope, key)` claims until that transaction
 * commits or rolls back.
 */
export async function claimCreatedTargetCommand<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  input: ClaimCreatedTargetCommandInput & { resultReferenceType: TReferenceType },
): Promise<ClaimCreatedTargetCommandResult<TReferenceType>> {
  assertConcretePrincipal(input)
  const actionName = requiredValue(input.actionName, "action name")
  const actionVersion = requiredValue(input.actionVersion ?? "v1", "action version")
  const commandTargetType = requiredValue(input.commandTarget.type, "command target type")
  const commandTargetId = requiredValue(input.commandTarget.id, "command target id")
  const canonicalTargetType = requiredValue(input.canonicalTargetType, "canonical target type")
  const resultReferenceType = validReferenceType(input.resultReferenceType)
  const idempotencyScope = requiredValue(input.idempotency.scope, "idempotency scope")
  const idempotencyKey = requiredValue(input.idempotency.key, "idempotency key")
  const idempotencyFingerprint = requiredValue(
    input.idempotency.fingerprint,
    "idempotency fingerprint",
  )
  if (!input.fingerprintInput || typeof input.fingerprintInput !== "object") {
    throw new TypeError("Created-target command fingerprint input is required")
  }
  const expectedFingerprint = await buildCreatedTargetCommandFingerprint({
    actionName,
    actionVersion,
    commandTarget: {
      type: commandTargetType,
      id: commandTargetId,
    },
    canonicalTargetType,
    resultReferenceType,
    commandInput: input.fingerprintInput.commandInput,
    policyInputs: input.fingerprintInput.policyInputs,
  })
  if (idempotencyFingerprint !== expectedFingerprint) {
    throw new ActionLedgerCreatedCommandFingerprintMismatchError(
      expectedFingerprint,
      idempotencyFingerprint,
    )
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${idempotencyScope}:${idempotencyKey}`}, 0))`,
  )

  const claimScope = `${idempotencyScope}${CLAIM_SCOPE_SUFFIX}`
  const existing = await findClaim(tx, claimScope, idempotencyKey)
  if (existing) {
    assertExactClaim(existing, {
      actionName,
      actionVersion,
      targetType: commandTargetType,
      targetId: commandTargetId,
      fingerprint: idempotencyFingerprint,
    })
    const claim = toClaim(existing, {
      canonicalTargetType,
      resultReferenceType,
      scope: idempotencyScope,
      key: idempotencyKey,
      fingerprint: idempotencyFingerprint,
    })
    return {
      claim,
      replayed: true,
      result: await readCompletedResult(tx, claim),
    }
  }

  const entryInput = buildActionLedgerMutationEntryInput({
    ...input,
    actionName,
    actionVersion,
    actionKind: input.actionKind ?? "create",
    status: "requested",
    targetType: commandTargetType,
    targetId: commandTargetId,
    idempotencyScope: claimScope,
    idempotencyKey,
    idempotencyFingerprint,
    mutationDetail: {
      ...input.mutationDetail,
      commandResultRef: null,
      reversalKind: input.mutationDetail?.reversalKind ?? "none",
    },
  })
  const inserted = await insertEntry(tx, entryInput)

  return {
    claim: toClaim(inserted.entry, {
      canonicalTargetType,
      resultReferenceType,
      scope: idempotencyScope,
      key: idempotencyKey,
      fingerprint: idempotencyFingerprint,
    }),
    replayed: false,
    result: null,
  }
}

/** Appends the canonical generated-target result in the claim's transaction. */
export async function completeCreatedTargetCommand<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  input: CompleteCreatedTargetCommandInput<TReferenceType>,
): Promise<CompleteCreatedTargetCommandResult<TReferenceType>> {
  const targetId = requiredValue(input.targetId, "canonical target id")
  const existing = await findResultEntry(tx, input.claim)
  if (existing) {
    const result = await validateCompletedResult(tx, input.claim, existing)
    if (result.reference.id !== targetId) {
      throw new ActionLedgerCreatedCommandReplayCorruptError(
        input.claim.entry.id,
        existing.id,
        "result_target_id_mismatch",
      )
    }
    return { ...result, replayed: true }
  }

  const commandResultRef = createCreatedTargetCommandResultReference(
    input.claim.resultReferenceType,
    targetId,
  )
  const inserted = await insertEntry(tx, {
    ...copyClaimEntry(input.claim.entry),
    status: "succeeded",
    targetType: input.claim.canonicalTargetType,
    targetId,
    causationActionId: input.claim.entry.id,
    idempotencyScope: resultScope(input.claim.idempotency.scope),
    idempotencyKey: input.claim.idempotency.key,
    idempotencyFingerprint: input.claim.idempotency.fingerprint,
    payloads: input.payloads,
    mutationDetail: {
      ...input.mutationDetail,
      commandResultRef,
      reversalKind: input.mutationDetail?.reversalKind ?? "none",
    },
  })

  return {
    entry: inserted.entry,
    reference: {
      type: input.claim.resultReferenceType,
      id: targetId,
      value: commandResultRef,
    },
    replayed: false,
  }
}

export function createCreatedTargetCommandResultReference<TReferenceType extends string>(
  referenceType: TReferenceType,
  targetId: string,
): CreatedTargetCommandResultReference<TReferenceType> {
  return `${validReferenceType(referenceType)}:${requiredValue(targetId, "canonical target id")}`
}

export async function buildCreatedTargetCommandFingerprint(
  input: BuildCreatedTargetCommandFingerprintInput,
): Promise<string> {
  const actionName = requiredValue(input.actionName, "action name")
  const actionVersion = requiredValue(input.actionVersion, "action version")
  const commandTargetType = requiredValue(input.commandTarget.type, "command target type")
  const commandTargetId = requiredValue(input.commandTarget.id, "command target id")
  const canonicalTargetType = requiredValue(input.canonicalTargetType, "canonical target type")
  const resultReferenceType = validReferenceType(input.resultReferenceType)
  if (
    !input.policyInputs ||
    typeof input.policyInputs !== "object" ||
    Array.isArray(input.policyInputs) ||
    Object.keys(input.policyInputs).length === 0
  ) {
    throw new TypeError(
      "Created-target command fingerprint policy inputs must be a non-empty object",
    )
  }

  return buildIdempotencyFingerprint({
    actionName,
    actionVersion,
    targetType: commandTargetType,
    targetId: commandTargetId,
    commandInput: input.commandInput ?? null,
    policyInputs: {
      createdTarget: {
        canonicalTargetType,
        resultReferenceType,
      },
      policy: input.policyInputs,
    },
  })
}

async function findClaim(
  tx: AnyDrizzleDb,
  idempotencyScope: string,
  idempotencyKey: string,
): Promise<ActionLedgerEntry | null> {
  const [row] = await tx
    .select({ claim: actionLedgerEntries })
    .from(actionLedgerEntries)
    .where(
      and(
        eq(actionLedgerEntries.idempotencyScope, idempotencyScope),
        eq(actionLedgerEntries.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1)
  return row?.claim ?? null
}

async function findResultEntry<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  claim: CreatedTargetCommandClaim<TReferenceType>,
): Promise<ActionLedgerEntry | null> {
  const [row] = await tx
    .select({ result: actionLedgerEntries })
    .from(actionLedgerEntries)
    .where(
      and(
        eq(actionLedgerEntries.causationActionId, claim.entry.id),
        eq(actionLedgerEntries.idempotencyScope, resultScope(claim.idempotency.scope)),
        eq(actionLedgerEntries.idempotencyKey, claim.idempotency.key),
        eq(actionLedgerEntries.status, "succeeded"),
      ),
    )
    .limit(1)
  return row?.result ?? null
}

async function readCompletedResult<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  claim: CreatedTargetCommandClaim<TReferenceType>,
): Promise<CreatedTargetCommandResultMetadata<TReferenceType>> {
  const resultEntry = await findResultEntry(tx, claim)
  if (!resultEntry) {
    throw new ActionLedgerCreatedCommandReplayIncompleteError(claim.entry.id)
  }
  return validateCompletedResult(tx, claim, resultEntry)
}

async function validateCompletedResult<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  claim: CreatedTargetCommandClaim<TReferenceType>,
  resultEntry: ActionLedgerEntry,
): Promise<CreatedTargetCommandResultMetadata<TReferenceType>> {
  if (resultEntry.actionName !== claim.entry.actionName) {
    throw corrupt(claim, resultEntry, "result_action_mismatch")
  }
  if (resultEntry.idempotencyFingerprint !== claim.idempotency.fingerprint) {
    throw corrupt(claim, resultEntry, "result_fingerprint_mismatch")
  }
  if (resultEntry.targetType !== claim.canonicalTargetType) {
    throw corrupt(claim, resultEntry, "result_target_type_mismatch")
  }

  const [detail] = await tx
    .select({ commandResultRef: actionMutationDetails.commandResultRef })
    .from(actionMutationDetails)
    .where(eq(actionMutationDetails.actionId, resultEntry.id))
    .limit(1)
  const reference = parseResultReference(
    claim,
    resultEntry,
    detail?.commandResultRef ?? null,
  )
  if (reference.id !== resultEntry.targetId) {
    throw corrupt(claim, resultEntry, "result_target_id_mismatch")
  }
  return { entry: resultEntry, reference }
}

function parseResultReference<TReferenceType extends string>(
  claim: CreatedTargetCommandClaim<TReferenceType>,
  resultEntry: ActionLedgerEntry,
  value: string | null,
): CreatedTargetCommandResultMetadata<TReferenceType>["reference"] {
  if (!value) {
    throw corrupt(claim, resultEntry, "malformed_result_reference")
  }
  const separator = value.indexOf(":")
  if (separator <= 0 || separator === value.length - 1) {
    throw corrupt(claim, resultEntry, "malformed_result_reference")
  }
  const type = value.slice(0, separator)
  const id = value.slice(separator + 1).trim()
  if (!id) {
    throw corrupt(claim, resultEntry, "malformed_result_reference")
  }
  if (type !== claim.resultReferenceType) {
    throw corrupt(claim, resultEntry, "wrong_result_reference_type")
  }
  return {
    type: claim.resultReferenceType,
    id,
    value: value as CreatedTargetCommandResultReference<TReferenceType>,
  }
}

function assertExactClaim(
  existing: ActionLedgerEntry,
  expected: {
    actionName: string
    actionVersion: string
    targetType: string
    targetId: string
    fingerprint: string
  },
): void {
  if (
    existing.actionName !== expected.actionName ||
    existing.actionVersion !== expected.actionVersion ||
    existing.targetType !== expected.targetType ||
    existing.targetId !== expected.targetId ||
    existing.idempotencyFingerprint !== expected.fingerprint
  ) {
    throw new ActionLedgerIdempotencyConflictError(existing.id)
  }
}

function toClaim<TReferenceType extends string>(
  entry: ActionLedgerEntry,
  input: {
    canonicalTargetType: string
    resultReferenceType: TReferenceType
    scope: string
    key: string
    fingerprint: string
  },
): CreatedTargetCommandClaim<TReferenceType> {
  return {
    entry,
    canonicalTargetType: input.canonicalTargetType,
    resultReferenceType: input.resultReferenceType,
    idempotency: {
      scope: input.scope,
      key: input.key,
      fingerprint: input.fingerprint,
    },
  }
}

function copyClaimEntry(entry: ActionLedgerEntry): Omit<
  AppendActionLedgerEntryInput,
  | "status"
  | "targetType"
  | "targetId"
  | "causationActionId"
  | "idempotencyScope"
  | "idempotencyKey"
  | "idempotencyFingerprint"
> {
  return {
    actionName: entry.actionName,
    actionVersion: entry.actionVersion,
    actionKind: entry.actionKind,
    evaluatedRisk: entry.evaluatedRisk,
    actorType: entry.actorType,
    principalType: entry.principalType,
    principalId: entry.principalId,
    principalSubtype: entry.principalSubtype,
    sessionId: entry.sessionId,
    apiTokenId: entry.apiTokenId,
    internalRequest: entry.internalRequest,
    delegatedByPrincipalType: entry.delegatedByPrincipalType,
    delegatedByPrincipalId: entry.delegatedByPrincipalId,
    delegationId: entry.delegationId,
    callerType: entry.callerType,
    organizationId: entry.organizationId,
    routeOrToolName: entry.routeOrToolName,
    workflowRunId: entry.workflowRunId,
    workflowStepId: entry.workflowStepId,
    correlationId: entry.correlationId,
    capabilityId: entry.capabilityId,
    capabilityVersion: entry.capabilityVersion,
    authorizationSource: entry.authorizationSource,
    approvalId: entry.approvalId,
    amendsActionId: null,
  }
}

function corrupt<TReferenceType extends string>(
  claim: CreatedTargetCommandClaim<TReferenceType>,
  resultEntry: ActionLedgerEntry,
  reason: ActionLedgerCreatedCommandReplayCorruptReason,
): ActionLedgerCreatedCommandReplayCorruptError {
  return new ActionLedgerCreatedCommandReplayCorruptError(
    claim.entry.id,
    resultEntry.id,
    reason,
  )
}

function resultScope(scope: string): string {
  return `${scope}${RESULT_SCOPE_SUFFIX}`
}

function assertConcretePrincipal(input: ClaimCreatedTargetCommandInput): void {
  const context = input.context ?? {}
  const candidates = [
    context.userId,
    context.agentId,
    context.workflowPrincipalId,
    context.workflowRunId,
    context.apiTokenId,
    context.apiKeyId,
    input.fallbackPrincipalId,
  ]
  if (!candidates.some((value) => typeof value === "string" && value.trim().length > 0)) {
    throw new TypeError("Created-target command claim requires a concrete request principal")
  }
}

function requiredValue(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(`Created-target command ${label} is required`)
  return normalized
}

function validReferenceType<TReferenceType extends string>(
  value: TReferenceType,
): TReferenceType {
  const normalized = requiredValue(value, "result reference type")
  if (normalized.includes(":")) {
    throw new TypeError("Created-target command result reference type cannot contain ':'")
  }
  return normalized as TReferenceType
}
