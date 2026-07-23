// agent-quality: file-size exception -- owner: action-ledger; claim, replay validation, and canonical completion form one transactional state machine.
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { dbSupportsTransactions } from "@voyant-travel/db/transaction-capability"
import { and, eq, sql } from "drizzle-orm"

import type {
  ActionLedgerCapabilityApprovalPolicy,
  ActionLedgerCapabilityRisk,
} from "./capability.js"
import { buildActionApprovalCommandFingerprint } from "./fingerprint.js"
import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildActionLedgerMutationEntryInput,
  mapActionLedgerRequestContext,
} from "./request-context.js"
import { type ActionLedgerEntry, actionLedgerEntries, actionMutationDetails } from "./schema.js"
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
  | "result_identity_mismatch"

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
    super("Created-target command fingerprint does not match its selected action policy")
    this.name = "ActionLedgerCreatedCommandFingerprintMismatchError"
    this.expectedFingerprint = expectedFingerprint
    this.receivedFingerprint = receivedFingerprint
  }
}

export class ActionLedgerCreatedCommandTransactionRequiredError extends Error {
  constructor() {
    super("Created-target command execution requires a transaction-capable database")
    this.name = "ActionLedgerCreatedCommandTransactionRequiredError"
  }
}

export class ActionLedgerCreatedCommandProtocolError extends Error {
  readonly reason:
    | "approval_policy_unsupported"
    | "claim_changed_during_mutation"
    | "result_created_during_mutation"

  constructor(reason: ActionLedgerCreatedCommandProtocolError["reason"]) {
    super(`Created-target command protocol failed closed: ${reason}`)
    this.name = "ActionLedgerCreatedCommandProtocolError"
    this.reason = reason
  }
}

export interface BuildCreatedTargetCommandFingerprintInput {
  actionName: string
  actionVersion: string
  commandTarget: { type: string; id: string }
  canonicalTargetType: string
  resultReferenceType: string
  commandInput?: unknown
  capabilityId: string
  capabilityVersion: string
  evaluatedRisk: ActionLedgerCapabilityRisk
  approvalPolicy: ActionLedgerCapabilityApprovalPolicy
  approvalReasonCode: string | null
}

type CreatedCommandCommonInput = Omit<
  BuildActionLedgerMutationInput,
  | "actionVersion"
  | "actionKind"
  | "status"
  | "evaluatedRisk"
  | "targetType"
  | "targetId"
  | "capabilityId"
  | "capabilityVersion"
  | "idempotencyScope"
  | "idempotencyKey"
  | "idempotencyFingerprint"
  | "mutationDetail"
>

export interface ExecuteCreatedTargetCommandInput extends CreatedCommandCommonInput {
  context: ActionLedgerRequestContextValues
  actionVersion: string
  actionKind?: Extract<ActionLedgerEntry["actionKind"], "create" | "execute">
  evaluatedRisk: ActionLedgerCapabilityRisk
  commandTarget: { type: string; id: string }
  canonicalTargetType: string
  resultReferenceType: string
  capabilityId: string
  capabilityVersion: string
  approvalPolicy: ActionLedgerCapabilityApprovalPolicy
  approvalReasonCode: string | null
  commandInput?: unknown
  idempotency: {
    scope: string
    key: string
    fingerprint: string
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

export interface CreatedTargetCommandMutation<TValue> {
  value: TValue
  targetId: string
  mutationDetail?: Omit<
    NonNullable<BuildActionLedgerMutationInput["mutationDetail"]>,
    "commandResultRef"
  >
  payloads?: AppendActionLedgerEntryInput["payloads"]
}

export interface ExecuteCreatedTargetCommandHandlers<TValue, TReferenceType extends string> {
  create: (tx: AnyDrizzleDb) => Promise<CreatedTargetCommandMutation<TValue>>
  replay: (
    tx: AnyDrizzleDb,
    result: CreatedTargetCommandResultMetadata<TReferenceType>,
  ) => Promise<TValue>
}

export type ExecuteCreatedTargetCommandResult<TValue, TReferenceType extends string = string> =
  | {
      replayed: false
      value: TValue
      result: CreatedTargetCommandResultMetadata<TReferenceType>
    }
  | {
      replayed: true
      value: TValue
      result: CreatedTargetCommandResultMetadata<TReferenceType>
    }

interface CreatedCommandState<TReferenceType extends string> {
  claim: ActionLedgerEntry
  expectedClaim: AppendActionLedgerEntryInput
  canonicalTargetType: string
  resultReferenceType: TReferenceType
  idempotency: { scope: string; key: string; fingerprint: string }
}

/**
 * Owns BEGIN → claim → domain mutation → canonical result → COMMIT.
 *
 * The claim is never exposed. Domain code receives only the exact transaction
 * handle owned by this helper. Exact replays resolve their immutable result
 * through `handlers.replay` without invoking `handlers.create`.
 */
export async function executeCreatedTargetCommand<TValue, TReferenceType extends string>(
  db: AnyDrizzleDb,
  input: ExecuteCreatedTargetCommandInput & { resultReferenceType: TReferenceType },
  handlers: ExecuteCreatedTargetCommandHandlers<TValue, TReferenceType>,
): Promise<ExecuteCreatedTargetCommandResult<TValue, TReferenceType>> {
  const prepared = await prepareCommand(input)
  return requiredTransaction(db, async (tx) => {
    await lockCommand(tx, prepared.idempotency.scope, prepared.idempotency.key)
    const existing = await findClaim(
      tx,
      claimScope(prepared.idempotency.scope),
      prepared.idempotency.key,
    )
    if (existing) {
      assertExactEntry(existing, prepared.expectedClaim)
      const state = toState(existing, prepared)
      const result = await readCompletedResult(tx, state)
      return {
        replayed: true,
        value: await handlers.replay(tx, result),
        result,
      }
    }

    const inserted = await insertEntry(tx, prepared.expectedClaim)
    const state = toState(inserted.entry, prepared)
    const mutation = await handlers.create(tx)
    await assertCurrentClaim(tx, state)
    if (await findResultEntry(tx, state)) {
      throw new ActionLedgerCreatedCommandProtocolError("result_created_during_mutation")
    }
    const result = await appendCompletedResult(tx, state, mutation)
    return { replayed: false, value: mutation.value, result }
  })
}

export async function buildCreatedTargetCommandFingerprint(
  input: BuildCreatedTargetCommandFingerprintInput,
): Promise<string> {
  return buildActionApprovalCommandFingerprint({
    actionName: requiredValue(input.actionName, "action name"),
    actionVersion: requiredValue(input.actionVersion, "action version"),
    targetType: requiredValue(input.commandTarget.type, "command target type"),
    targetId: requiredValue(input.commandTarget.id, "command target id"),
    commandInput: input.commandInput ?? null,
    approvalPolicy: input.approvalPolicy,
    capabilityId: requiredValue(input.capabilityId, "capability id"),
    capabilityVersion: requiredValue(input.capabilityVersion, "capability version"),
    evaluatedRisk: input.evaluatedRisk,
    reasonCode: input.approvalReasonCode,
    createdTarget: {
      canonicalTargetType: requiredValue(input.canonicalTargetType, "canonical target type"),
      resultReferenceType: validReferenceType(input.resultReferenceType),
    },
  })
}

export function createCreatedTargetCommandResultReference<TReferenceType extends string>(
  referenceType: TReferenceType,
  targetId: string,
): CreatedTargetCommandResultReference<TReferenceType> {
  return `${validReferenceType(referenceType)}:${requiredValue(targetId, "canonical target id")}`
}

async function prepareCommand<TReferenceType extends string>(
  input: ExecuteCreatedTargetCommandInput & { resultReferenceType: TReferenceType },
) {
  const actor = mapActionLedgerRequestContext(input.context, input)
  if (actor.principalId === "unknown_request") {
    throw new TypeError("Created-target command execution requires a concrete request principal")
  }
  const actionName = requiredValue(input.actionName, "action name")
  const actionVersion = requiredValue(input.actionVersion, "action version")
  const commandTargetType = requiredValue(input.commandTarget.type, "command target type")
  const commandTargetId = requiredValue(input.commandTarget.id, "command target id")
  const canonicalTargetType = requiredValue(input.canonicalTargetType, "canonical target type")
  const resultReferenceType = validReferenceType(input.resultReferenceType)
  const scope = requiredValue(input.idempotency.scope, "idempotency scope")
  const key = requiredValue(input.idempotency.key, "idempotency key")
  const fingerprint = requiredValue(input.idempotency.fingerprint, "idempotency fingerprint")
  const expectedFingerprint = await buildCreatedTargetCommandFingerprint({
    actionName,
    actionVersion,
    commandTarget: { type: commandTargetType, id: commandTargetId },
    canonicalTargetType,
    resultReferenceType,
    commandInput: input.commandInput,
    capabilityId: input.capabilityId,
    capabilityVersion: input.capabilityVersion,
    evaluatedRisk: input.evaluatedRisk,
    approvalPolicy: input.approvalPolicy,
    approvalReasonCode: input.approvalReasonCode,
  })
  if (fingerprint !== expectedFingerprint) {
    throw new ActionLedgerCreatedCommandFingerprintMismatchError(expectedFingerprint, fingerprint)
  }
  if (input.approvalPolicy !== "none" || input.approvalId) {
    throw new ActionLedgerCreatedCommandProtocolError("approval_policy_unsupported")
  }

  const expectedClaim = buildActionLedgerMutationEntryInput({
    ...input,
    actionName,
    actionVersion,
    actionKind: input.actionKind ?? "create",
    status: "requested",
    targetType: commandTargetType,
    targetId: commandTargetId,
    capabilityId: requiredValue(input.capabilityId, "capability id"),
    capabilityVersion: requiredValue(input.capabilityVersion, "capability version"),
    idempotencyScope: claimScope(scope),
    idempotencyKey: key,
    idempotencyFingerprint: fingerprint,
    mutationDetail: {
      ...input.mutationDetail,
      commandResultRef: null,
      reversalKind: input.mutationDetail?.reversalKind ?? "none",
    },
  })
  return {
    expectedClaim,
    canonicalTargetType,
    resultReferenceType,
    idempotency: { scope, key, fingerprint },
  }
}

async function requiredTransaction<T>(
  db: AnyDrizzleDb,
  run: (tx: AnyDrizzleDb) => Promise<T>,
): Promise<T> {
  if (dbSupportsTransactions(db) === false) {
    throw new ActionLedgerCreatedCommandTransactionRequiredError()
  }
  const transactional = db as AnyDrizzleDb & {
    transaction?: (callback: (tx: AnyDrizzleDb) => Promise<T>) => Promise<T>
  }
  if (typeof transactional.transaction !== "function") {
    throw new ActionLedgerCreatedCommandTransactionRequiredError()
  }
  return transactional.transaction(run)
}

async function lockCommand(tx: AnyDrizzleDb, scope: string, key: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${key}`}, 0))`)
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

async function assertCurrentClaim<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  state: CreatedCommandState<TReferenceType>,
): Promise<void> {
  const current = await findClaim(tx, claimScope(state.idempotency.scope), state.idempotency.key)
  if (!current || current.id !== state.claim.id) {
    throw new ActionLedgerCreatedCommandProtocolError("claim_changed_during_mutation")
  }
  try {
    assertExactEntry(current, state.expectedClaim)
  } catch {
    throw new ActionLedgerCreatedCommandProtocolError("claim_changed_during_mutation")
  }
}

async function findResultEntry<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  state: CreatedCommandState<TReferenceType>,
): Promise<ActionLedgerEntry | null> {
  const [row] = await tx
    .select({ result: actionLedgerEntries })
    .from(actionLedgerEntries)
    .where(
      and(
        eq(actionLedgerEntries.idempotencyScope, resultScope(state.idempotency.scope)),
        eq(actionLedgerEntries.idempotencyKey, state.idempotency.key),
      ),
    )
    .limit(1)
  return row?.result ?? null
}

async function readCompletedResult<TReferenceType extends string>(
  tx: AnyDrizzleDb,
  state: CreatedCommandState<TReferenceType>,
): Promise<CreatedTargetCommandResultMetadata<TReferenceType>> {
  const entry = await findResultEntry(tx, state)
  if (!entry) throw new ActionLedgerCreatedCommandReplayIncompleteError(state.claim.id)
  assertResultIdentity(state, entry)
  const [detail] = await tx
    .select({ commandResultRef: actionMutationDetails.commandResultRef })
    .from(actionMutationDetails)
    .where(eq(actionMutationDetails.actionId, entry.id))
    .limit(1)
  const reference = parseResultReference(state, entry, detail?.commandResultRef ?? null)
  if (reference.id !== entry.targetId) {
    throw corrupt(state, entry, "result_target_id_mismatch")
  }
  return { entry, reference }
}

async function appendCompletedResult<TValue, TReferenceType extends string>(
  tx: AnyDrizzleDb,
  state: CreatedCommandState<TReferenceType>,
  mutation: CreatedTargetCommandMutation<TValue>,
): Promise<CreatedTargetCommandResultMetadata<TReferenceType>> {
  const targetId = requiredValue(mutation.targetId, "canonical target id")
  const commandResultRef = createCreatedTargetCommandResultReference(
    state.resultReferenceType,
    targetId,
  )
  const inserted = await insertEntry(tx, {
    ...copyClaimEntry(state.claim),
    status: "succeeded",
    targetType: state.canonicalTargetType,
    targetId,
    causationActionId: state.claim.id,
    idempotencyScope: resultScope(state.idempotency.scope),
    idempotencyKey: state.idempotency.key,
    idempotencyFingerprint: state.idempotency.fingerprint,
    payloads: mutation.payloads,
    mutationDetail: {
      ...mutation.mutationDetail,
      commandResultRef,
      reversalKind: mutation.mutationDetail?.reversalKind ?? "none",
    },
  })
  return {
    entry: inserted.entry,
    reference: {
      type: state.resultReferenceType,
      id: targetId,
      value: commandResultRef,
    },
  }
}

function assertExactEntry(actual: ActionLedgerEntry, expected: AppendActionLedgerEntryInput): void {
  for (const field of CLAIM_IDENTITY_FIELDS) {
    if (actual[field] !== expected[field]) {
      throw new ActionLedgerIdempotencyConflictError(actual.id)
    }
  }
}

function assertResultIdentity<TReferenceType extends string>(
  state: CreatedCommandState<TReferenceType>,
  entry: ActionLedgerEntry,
): void {
  if (entry.actionName !== state.claim.actionName) {
    throw corrupt(state, entry, "result_action_mismatch")
  }
  if (entry.idempotencyFingerprint !== state.idempotency.fingerprint) {
    throw corrupt(state, entry, "result_fingerprint_mismatch")
  }
  if (entry.targetType !== state.canonicalTargetType) {
    throw corrupt(state, entry, "result_target_type_mismatch")
  }
  for (const field of RESULT_CONTINUITY_FIELDS) {
    if (entry[field] !== state.claim[field]) {
      throw corrupt(state, entry, "result_identity_mismatch")
    }
  }
  if (
    entry.status !== "succeeded" ||
    entry.causationActionId !== state.claim.id ||
    entry.idempotencyScope !== resultScope(state.idempotency.scope) ||
    entry.idempotencyKey !== state.idempotency.key ||
    entry.approvalId !== state.claim.approvalId
  ) {
    throw corrupt(state, entry, "result_identity_mismatch")
  }
}

function parseResultReference<TReferenceType extends string>(
  state: CreatedCommandState<TReferenceType>,
  entry: ActionLedgerEntry,
  value: string | null,
): CreatedTargetCommandResultMetadata<TReferenceType>["reference"] {
  if (!value) throw corrupt(state, entry, "malformed_result_reference")
  const separator = value.indexOf(":")
  if (separator <= 0 || separator === value.length - 1) {
    throw corrupt(state, entry, "malformed_result_reference")
  }
  const type = value.slice(0, separator)
  const rawId = value.slice(separator + 1)
  const id = rawId.trim()
  if (!id) throw corrupt(state, entry, "malformed_result_reference")
  if (type !== state.resultReferenceType) {
    throw corrupt(state, entry, "wrong_result_reference_type")
  }
  if (value !== `${state.resultReferenceType}:${id}`) {
    throw corrupt(state, entry, "malformed_result_reference")
  }
  return {
    type: state.resultReferenceType,
    id,
    value: value as CreatedTargetCommandResultReference<TReferenceType>,
  }
}

function toState<TReferenceType extends string>(
  claim: ActionLedgerEntry,
  prepared: {
    expectedClaim: AppendActionLedgerEntryInput
    canonicalTargetType: string
    resultReferenceType: TReferenceType
    idempotency: { scope: string; key: string; fingerprint: string }
  },
): CreatedCommandState<TReferenceType> {
  return { claim, ...prepared }
}

function copyClaimEntry(
  entry: ActionLedgerEntry,
): Omit<
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
  state: CreatedCommandState<TReferenceType>,
  entry: ActionLedgerEntry,
  reason: ActionLedgerCreatedCommandReplayCorruptReason,
): ActionLedgerCreatedCommandReplayCorruptError {
  return new ActionLedgerCreatedCommandReplayCorruptError(state.claim.id, entry.id, reason)
}

const CLAIM_IDENTITY_FIELDS = [
  "actionName",
  "actionVersion",
  "actionKind",
  "status",
  "evaluatedRisk",
  "actorType",
  "principalType",
  "principalId",
  "principalSubtype",
  "internalRequest",
  "delegatedByPrincipalType",
  "delegatedByPrincipalId",
  "delegationId",
  "organizationId",
  "routeOrToolName",
  "causationActionId",
  "idempotencyScope",
  "idempotencyKey",
  "idempotencyFingerprint",
  "targetType",
  "targetId",
  "capabilityId",
  "capabilityVersion",
  "authorizationSource",
  "approvalId",
] as const satisfies readonly (keyof ActionLedgerEntry)[]

const RESULT_CONTINUITY_FIELDS = [
  "actionVersion",
  "actionKind",
  "evaluatedRisk",
  "actorType",
  "principalType",
  "principalId",
  "principalSubtype",
  "sessionId",
  "apiTokenId",
  "internalRequest",
  "delegatedByPrincipalType",
  "delegatedByPrincipalId",
  "delegationId",
  "callerType",
  "organizationId",
  "routeOrToolName",
  "workflowRunId",
  "workflowStepId",
  "correlationId",
  "capabilityId",
  "capabilityVersion",
  "authorizationSource",
] as const satisfies readonly (keyof ActionLedgerEntry)[]

function claimScope(scope: string): string {
  return `${scope}${CLAIM_SCOPE_SUFFIX}`
}

function resultScope(scope: string): string {
  return `${scope}${RESULT_SCOPE_SUFFIX}`
}

function requiredValue(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(`Created-target command ${label} is required`)
  return normalized
}

function validReferenceType<TReferenceType extends string>(value: TReferenceType): TReferenceType {
  const normalized = requiredValue(value, "result reference type")
  if (normalized.includes(":")) {
    throw new TypeError("Created-target command result reference type cannot contain ':'")
  }
  return normalized as TReferenceType
}
