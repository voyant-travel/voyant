import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ActionApproval, ActionLedgerEntry, NewActionMutationDetail } from "./schema.js"
import type {
  AppendActionLedgerEntryInput,
  AppendActionLedgerEntryResult,
  DecideActionApprovalInput,
  DecideActionApprovalResult,
  RequestActionApprovalInput,
  RequestActionApprovalResult,
} from "./service.js"
import { actionLedgerService } from "./service.js"

export const ACTION_LEDGER_APPROVAL_ID_HEADER = "action-approval-id"

export interface ActionLedgerRequestContextValues {
  userId?: string | null
  agentId?: string | null
  workflowPrincipalId?: string | null
  principalSubtype?: string | null
  sessionId?: string | null
  apiTokenId?: string | null
  apiKeyId?: string | null
  callerType?: string | null
  actor?: string | null
  isInternalRequest?: boolean | null
  organizationId?: string | null
  workflowRunId?: string | null
  workflowStepId?: string | null
  correlationId?: string | null
}

export interface ActionLedgerActorFields {
  actorType: string | null
  principalType: ActionLedgerEntry["principalType"]
  principalId: string
  principalSubtype: string | null
  sessionId: string | null
  apiTokenId: string | null
  internalRequest: boolean
  callerType: string | null
  organizationId: string | null
  workflowRunId: string | null
  workflowStepId: string | null
  correlationId: string | null
}

export interface ActionLedgerRequestMappingOptions {
  fallbackPrincipalId?: string
}

export interface BuildActionLedgerSensitiveReadInput
  extends CommonActionLedgerRouteInput,
    ActionLedgerRequestMappingOptions {
  status?: Extract<ActionLedgerEntry["status"], "succeeded" | "denied" | "failed">
  reasonCode?: string | null
  disclosedFieldSet?: string[] | null
  disclosureSummary?: string | null
  decisionPolicy?: string | null
}

export type BuildActionLedgerSensitiveReadInputForValue<T> =
  | BuildActionLedgerSensitiveReadInput
  | ((value: T) => BuildActionLedgerSensitiveReadInput)

export interface BuildActionLedgerMutationInput
  extends CommonActionLedgerRouteInput,
    ActionLedgerRequestMappingOptions {
  actionKind: Extract<ActionLedgerEntry["actionKind"], "create" | "update" | "delete" | "execute">
  status?: ActionLedgerEntry["status"]
  mutationDetail?: Omit<NewActionMutationDetail, "actionId">
}

export interface BuildActionLedgerApprovalRequestInput
  extends Omit<BuildActionLedgerMutationInput, "status"> {
  approval: {
    requestedByPrincipalId?: string | null
    assignedToPrincipalId?: string | null
    delegatedFromPrincipalId?: string | null
    policyName: string
    policyVersion: string
    targetSnapshotRef?: string | null
    riskSnapshot?: ActionApproval["riskSnapshot"] | null
    reasonCode?: string | null
    expiresAt?: Date | string | null
  }
}

export interface BuildActionLedgerApprovalDecisionInput extends ActionLedgerRequestMappingOptions {
  context: ActionLedgerRequestContextValues
  id: string
  status: Exclude<ActionApproval["status"], "pending">
  decidedByPrincipalId?: string | null
  decidedAt?: Date | string | null
  actionName: string
  actionVersion?: string
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"]
  targetType?: string
  targetId?: string
  routeOrToolName?: string | null
  capabilityId?: string | null
  capabilityVersion?: string | null
  authorizationSource?: string | null
  idempotencyScope?: string | null
  idempotencyKey?: string | null
  idempotencyFingerprint?: string | null
  payloads?: AppendActionLedgerEntryInput["payloads"]
  organizationId?: string | null
  workflowRunId?: string | null
  workflowStepId?: string | null
  correlationId?: string | null
}

export interface BuildActionLedgerApprovedExecutionFieldsInput {
  requestedActionId: string
  approvalId: string
  idempotencyFingerprint: string
}

export interface ActionLedgerApprovedExecutionFields {
  causationActionId: string
  approvalId: string
  idempotencyScope: string
  idempotencyKey: string
  idempotencyFingerprint: string
}

interface CommonActionLedgerRouteInput {
  context: ActionLedgerRequestContextValues
  actionName: string
  actionVersion?: string
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"]
  targetType: string
  targetId: string
  routeOrToolName?: string | null
  capabilityId?: string | null
  capabilityVersion?: string | null
  authorizationSource?: string | null
  causationActionId?: string | null
  approvalId?: string | null
  idempotencyScope?: string | null
  idempotencyKey?: string | null
  idempotencyFingerprint?: string | null
  payloads?: AppendActionLedgerEntryInput["payloads"]
  organizationId?: string | null
  workflowRunId?: string | null
  workflowStepId?: string | null
  correlationId?: string | null
}

export function mapActionLedgerRequestContext(
  context: ActionLedgerRequestContextValues,
  options: ActionLedgerRequestMappingOptions = {},
): ActionLedgerActorFields {
  const actor = normalizeNullableString(context.actor)
  const callerType = normalizeNullableString(context.callerType)
  const userId = normalizeNullableString(context.userId)
  const agentId = normalizeNullableString(context.agentId)
  const workflowRunId = normalizeNullableString(context.workflowRunId)
  const workflowPrincipalId = normalizeNullableString(context.workflowPrincipalId) ?? workflowRunId
  const principalSubtype = normalizeNullableString(context.principalSubtype)
  const sessionId = normalizeNullableString(context.sessionId)
  const apiTokenId = normalizeNullableString(context.apiTokenId ?? context.apiKeyId)
  const internalRequest = context.isInternalRequest === true || callerType === "internal"

  if (apiTokenId && callerType === "api_key") {
    return {
      actorType: actor,
      principalType: "api_key",
      principalId: apiTokenId,
      principalSubtype,
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId,
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  if (agentId && callerType === "agent") {
    return {
      actorType: actor,
      principalType: "agent",
      principalId: agentId,
      principalSubtype,
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId,
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  if (workflowPrincipalId && callerType === "workflow") {
    return {
      actorType: actor,
      principalType: "workflow",
      principalId: workflowPrincipalId,
      principalSubtype,
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId,
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  if (internalRequest) {
    return {
      actorType: actor,
      principalType: "system",
      principalId: userId ?? apiTokenId ?? options.fallbackPrincipalId ?? "internal_request",
      principalSubtype,
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId,
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  return {
    actorType: actor,
    principalType: userId ? "user" : "system",
    principalId: userId ?? options.fallbackPrincipalId ?? "unknown_request",
    principalSubtype,
    sessionId,
    apiTokenId,
    internalRequest,
    callerType,
    organizationId: normalizeNullableString(context.organizationId),
    workflowRunId,
    workflowStepId: normalizeNullableString(context.workflowStepId),
    correlationId: normalizeNullableString(context.correlationId),
  }
}

export function buildActionLedgerSensitiveReadEntryInput(
  input: BuildActionLedgerSensitiveReadInput,
): AppendActionLedgerEntryInput {
  const actorFields = mapActionLedgerRequestContext(input.context, input)

  return {
    ...actorFields,
    actionName: input.actionName,
    actionVersion: input.actionVersion ?? "v1",
    actionKind: "read",
    status: input.status ?? "succeeded",
    evaluatedRisk: input.evaluatedRisk ?? "high",
    targetType: input.targetType,
    targetId: input.targetId,
    routeOrToolName: input.routeOrToolName ?? null,
    capabilityId: input.capabilityId ?? null,
    capabilityVersion: input.capabilityVersion ?? null,
    authorizationSource: input.authorizationSource ?? null,
    causationActionId: input.causationActionId ?? null,
    approvalId: input.approvalId ?? null,
    idempotencyScope: input.idempotencyScope ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    idempotencyFingerprint: input.idempotencyFingerprint ?? null,
    payloads: input.payloads,
    organizationId: input.organizationId ?? actorFields.organizationId,
    workflowRunId: input.workflowRunId ?? actorFields.workflowRunId,
    workflowStepId: input.workflowStepId ?? actorFields.workflowStepId,
    correlationId: input.correlationId ?? actorFields.correlationId,
    sensitiveReadDetail: {
      reasonCode: input.reasonCode ?? null,
      disclosedFieldSet: input.disclosedFieldSet ?? null,
      disclosureSummary: input.disclosureSummary ?? null,
      decisionPolicy: input.decisionPolicy ?? null,
    },
  }
}

export async function appendActionLedgerSensitiveRead(
  db: AnyDrizzleDb,
  input: BuildActionLedgerSensitiveReadInput,
): Promise<AppendActionLedgerEntryResult> {
  return actionLedgerService.appendEntry(db, buildActionLedgerSensitiveReadEntryInput(input))
}

export async function ledgerSensitiveRead<T>(
  db: AnyDrizzleDb,
  input: BuildActionLedgerSensitiveReadInputForValue<T>,
  read: () => T | Promise<T>,
): Promise<T> {
  if (typeof input !== "function") {
    await appendActionLedgerSensitiveRead(db, input)
    return read()
  }

  const value = await read()
  await appendActionLedgerSensitiveRead(db, input(value))
  return value
}

export function buildActionLedgerMutationEntryInput(
  input: BuildActionLedgerMutationInput,
): AppendActionLedgerEntryInput {
  const actorFields = mapActionLedgerRequestContext(input.context, input)

  return {
    ...actorFields,
    actionName: input.actionName,
    actionVersion: input.actionVersion ?? "v1",
    actionKind: input.actionKind,
    status: input.status ?? "succeeded",
    evaluatedRisk: input.evaluatedRisk ?? "medium",
    targetType: input.targetType,
    targetId: input.targetId,
    routeOrToolName: input.routeOrToolName ?? null,
    capabilityId: input.capabilityId ?? null,
    capabilityVersion: input.capabilityVersion ?? null,
    authorizationSource: input.authorizationSource ?? null,
    causationActionId: input.causationActionId ?? null,
    approvalId: input.approvalId ?? null,
    idempotencyScope: input.idempotencyScope ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    idempotencyFingerprint: input.idempotencyFingerprint ?? null,
    payloads: input.payloads,
    organizationId: input.organizationId ?? actorFields.organizationId,
    workflowRunId: input.workflowRunId ?? actorFields.workflowRunId,
    workflowStepId: input.workflowStepId ?? actorFields.workflowStepId,
    correlationId: input.correlationId ?? actorFields.correlationId,
    mutationDetail: input.mutationDetail,
  }
}

export async function appendActionLedgerMutation(
  db: AnyDrizzleDb,
  input: BuildActionLedgerMutationInput,
): Promise<AppendActionLedgerEntryResult> {
  return actionLedgerService.appendEntry(db, buildActionLedgerMutationEntryInput(input))
}

export function buildActionLedgerApprovalRequestInput(
  input: BuildActionLedgerApprovalRequestInput,
): RequestActionApprovalInput {
  const {
    status: _status,
    approvalId: _approvalId,
    ...requestedAction
  } = buildActionLedgerMutationEntryInput(input)

  return {
    requestedAction,
    approval: {
      requestedByPrincipalId: input.approval.requestedByPrincipalId ?? requestedAction.principalId,
      assignedToPrincipalId: input.approval.assignedToPrincipalId ?? null,
      delegatedFromPrincipalId: input.approval.delegatedFromPrincipalId ?? null,
      policyName: input.approval.policyName,
      policyVersion: input.approval.policyVersion,
      targetSnapshotRef: input.approval.targetSnapshotRef ?? null,
      riskSnapshot: input.approval.riskSnapshot ?? requestedAction.evaluatedRisk,
      reasonCode: input.approval.reasonCode ?? null,
      expiresAt: input.approval.expiresAt ?? null,
    },
  }
}

export async function requestActionLedgerApproval(
  db: AnyDrizzleDb,
  input: BuildActionLedgerApprovalRequestInput,
): Promise<RequestActionApprovalResult> {
  return actionLedgerService.requestApproval(db, buildActionLedgerApprovalRequestInput(input))
}

export function buildActionLedgerApprovalDecisionInput(
  input: BuildActionLedgerApprovalDecisionInput,
): DecideActionApprovalInput {
  const actorFields = mapActionLedgerRequestContext(input.context, input)

  return {
    id: input.id,
    status: input.status,
    decidedByPrincipalId: input.decidedByPrincipalId ?? actorFields.principalId,
    decidedAt: input.decidedAt ?? null,
    decisionAction: {
      ...actorFields,
      actionName: input.actionName,
      actionVersion: input.actionVersion ?? "v1",
      evaluatedRisk: input.evaluatedRisk,
      targetType: input.targetType,
      targetId: input.targetId,
      routeOrToolName: input.routeOrToolName ?? null,
      capabilityId: input.capabilityId ?? null,
      capabilityVersion: input.capabilityVersion ?? null,
      authorizationSource: input.authorizationSource ?? null,
      idempotencyScope: input.idempotencyScope ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      idempotencyFingerprint: input.idempotencyFingerprint ?? null,
      payloads: input.payloads,
      organizationId: input.organizationId ?? actorFields.organizationId,
      workflowRunId: input.workflowRunId ?? actorFields.workflowRunId,
      workflowStepId: input.workflowStepId ?? actorFields.workflowStepId,
      correlationId: input.correlationId ?? actorFields.correlationId,
    },
  }
}

export async function decideActionLedgerApproval(
  db: AnyDrizzleDb,
  input: BuildActionLedgerApprovalDecisionInput,
): Promise<DecideActionApprovalResult | null> {
  return actionLedgerService.decideApproval(db, buildActionLedgerApprovalDecisionInput(input))
}

export function buildActionLedgerApprovedExecutionFields(
  input: BuildActionLedgerApprovedExecutionFieldsInput,
): ActionLedgerApprovedExecutionFields {
  return {
    causationActionId: input.requestedActionId,
    approvalId: input.approvalId,
    idempotencyScope: `${input.approvalId}:execution`,
    idempotencyKey: input.approvalId,
    idempotencyFingerprint: input.idempotencyFingerprint,
  }
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null
  return value
}
