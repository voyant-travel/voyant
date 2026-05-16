import type { AnyDrizzleDb } from "@voyantjs/db"
import type { ActionLedgerEntry, NewActionMutationDetail } from "./schema.js"
import type { AppendActionLedgerEntryInput, AppendActionLedgerEntryResult } from "./service.js"
import { actionLedgerService } from "./service.js"

export interface ActionLedgerRequestContextValues {
  userId?: string | null
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

export interface BuildActionLedgerMutationInput
  extends CommonActionLedgerRouteInput,
    ActionLedgerRequestMappingOptions {
  actionKind: Extract<ActionLedgerEntry["actionKind"], "create" | "update" | "delete" | "execute">
  status?: ActionLedgerEntry["status"]
  mutationDetail?: Omit<NewActionMutationDetail, "actionId">
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
  idempotencyScope?: string | null
  idempotencyKey?: string | null
  idempotencyFingerprint?: string | null
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
  const sessionId = normalizeNullableString(context.sessionId)
  const apiTokenId = normalizeNullableString(context.apiTokenId ?? context.apiKeyId)
  const internalRequest = context.isInternalRequest === true || callerType === "internal"

  if (apiTokenId && callerType === "api_key") {
    return {
      actorType: actor,
      principalType: "api_key",
      principalId: apiTokenId,
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId: normalizeNullableString(context.workflowRunId),
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  if (internalRequest) {
    return {
      actorType: actor,
      principalType: "system",
      principalId: userId ?? apiTokenId ?? options.fallbackPrincipalId ?? "internal_request",
      sessionId,
      apiTokenId,
      internalRequest,
      callerType,
      organizationId: normalizeNullableString(context.organizationId),
      workflowRunId: normalizeNullableString(context.workflowRunId),
      workflowStepId: normalizeNullableString(context.workflowStepId),
      correlationId: normalizeNullableString(context.correlationId),
    }
  }

  return {
    actorType: actor,
    principalType: userId ? "user" : "system",
    principalId: userId ?? options.fallbackPrincipalId ?? "unknown_request",
    sessionId,
    apiTokenId,
    internalRequest,
    callerType,
    organizationId: normalizeNullableString(context.organizationId),
    workflowRunId: normalizeNullableString(context.workflowRunId),
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
    idempotencyScope: input.idempotencyScope ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    idempotencyFingerprint: input.idempotencyFingerprint ?? null,
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
  input: BuildActionLedgerSensitiveReadInput,
  read: () => T | Promise<T>,
): Promise<T> {
  const value = await read()
  await appendActionLedgerSensitiveRead(db, input)
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
    idempotencyScope: input.idempotencyScope ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    idempotencyFingerprint: input.idempotencyFingerprint ?? null,
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

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null
  return value
}
