import { z } from "zod"

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
const actionLedgerApprovalStatusValues = [
  "pending",
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
] as const
const actionLedgerReversalKindValues = ["none", "revert", "compensate", "domain_command"] as const
const actionLedgerReversalStateValues = [
  "not_reversible",
  "available",
  "requested",
  "running",
  "completed",
  "failed",
  "expired",
] as const
const actionLedgerReversalOutcomeValues = ["full", "partial", "failed"] as const

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

function commaSeparatedStringList() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  }, z.array(z.string().trim().min(1)).min(1).optional())
}

export const actionLedgerEntryListQuerySchema = z
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
    targetIds: commaSeparatedStringList(),
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
    reversalKind: commaSeparatedEnumList(actionLedgerReversalKindValues),
    reversalState: commaSeparatedEnumList(actionLedgerReversalStateValues),
    reversalOutcome: commaSeparatedEnumList(actionLedgerReversalOutcomeValues),
    reversesActionId: z.string().trim().min(1).optional(),
    reversedByActionId: z.string().trim().min(1).optional(),
    sensitiveReasonCode: z.string().trim().min(1).optional(),
    decisionPolicy: z.string().trim().min(1).optional(),
    occurredAtFrom: z.string().datetime().optional(),
    occurredAtTo: z.string().datetime().optional(),
    cursorOccurredAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
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
  .superRefine((value, ctx) => {
    if (!value.targetId || !value.targetIds) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetIds"],
      message: "targetId and targetIds cannot be provided together",
    })
  })
  .transform(({ cursorOccurredAt, cursorId, occurredAtFrom, occurredAtTo, ...query }) => ({
    ...query,
    occurredAtFrom: occurredAtFrom ? new Date(occurredAtFrom) : undefined,
    occurredAtTo: occurredAtTo ? new Date(occurredAtTo) : undefined,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

export const actionApprovalListQuerySchema = z
  .object({
    requestedActionId: z.string().trim().min(1).optional(),
    status: commaSeparatedEnumList(actionLedgerApprovalStatusValues),
    requestedByPrincipalId: z.string().trim().min(1).optional(),
    assignedToPrincipalId: z.string().trim().min(1).optional(),
    decidedByPrincipalId: z.string().trim().min(1).optional(),
    delegatedFromPrincipalId: z.string().trim().min(1).optional(),
    policyName: z.string().trim().min(1).optional(),
    policyVersion: z.string().trim().min(1).optional(),
    riskSnapshot: commaSeparatedEnumList(actionLedgerRiskValues),
    reasonCode: z.string().trim().min(1).optional(),
    expiresAtFrom: z.string().datetime().optional(),
    expiresAtTo: z.string().datetime().optional(),
    decidedAtFrom: z.string().datetime().optional(),
    decidedAtTo: z.string().datetime().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    cursorCreatedAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorCreatedAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorCreatedAt ? ["cursorId"] : ["cursorCreatedAt"],
      message: "cursorCreatedAt and cursorId must be provided together",
    })
  })
  .transform(
    ({
      cursorCreatedAt,
      cursorId,
      expiresAtFrom,
      expiresAtTo,
      decidedAtFrom,
      decidedAtTo,
      createdAtFrom,
      createdAtTo,
      ...query
    }) => ({
      ...query,
      expiresAtFrom: expiresAtFrom ? new Date(expiresAtFrom) : undefined,
      expiresAtTo: expiresAtTo ? new Date(expiresAtTo) : undefined,
      decidedAtFrom: decidedAtFrom ? new Date(decidedAtFrom) : undefined,
      decidedAtTo: decidedAtTo ? new Date(decidedAtTo) : undefined,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      cursor:
        cursorCreatedAt && cursorId
          ? {
              createdAt: cursorCreatedAt,
              id: cursorId,
            }
          : undefined,
    }),
  )

const nullableTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => value ?? null)

const actionLedgerApprovalRequestedActionBodySchema = z.object({
  actionName: z.string().trim().min(1),
  actionVersion: z.string().trim().min(1).default("v1"),
  actionKind: z.enum(actionLedgerActionKindValues),
  evaluatedRisk: z.enum(actionLedgerRiskValues),
  actorType: nullableTrimmedString,
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string().trim().min(1),
  principalSubtype: nullableTrimmedString,
  sessionId: nullableTrimmedString,
  apiTokenId: nullableTrimmedString,
  internalRequest: z.boolean().default(false),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
  delegatedByPrincipalId: nullableTrimmedString,
  delegationId: nullableTrimmedString,
  callerType: nullableTrimmedString,
  organizationId: nullableTrimmedString,
  routeOrToolName: nullableTrimmedString,
  workflowRunId: nullableTrimmedString,
  workflowStepId: nullableTrimmedString,
  correlationId: nullableTrimmedString,
  causationActionId: nullableTrimmedString,
  idempotencyScope: nullableTrimmedString,
  idempotencyKey: nullableTrimmedString,
  idempotencyFingerprint: nullableTrimmedString,
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  capabilityId: nullableTrimmedString,
  capabilityVersion: nullableTrimmedString,
  authorizationSource: nullableTrimmedString,
  amendsActionId: nullableTrimmedString,
})

export const requestActionApprovalBodySchema = z
  .object({
    requestedAction: actionLedgerApprovalRequestedActionBodySchema,
    approval: z.object({
      requestedByPrincipalId: nullableTrimmedString,
      assignedToPrincipalId: nullableTrimmedString,
      delegatedFromPrincipalId: nullableTrimmedString,
      policyName: z.string().trim().min(1),
      policyVersion: z.string().trim().min(1),
      targetSnapshotRef: nullableTrimmedString,
      riskSnapshot: z.enum(actionLedgerRiskValues).optional(),
      reasonCode: nullableTrimmedString,
      expiresAt: z.string().datetime().optional(),
    }),
  })
  .transform(({ approval, ...body }) => ({
    ...body,
    approval: {
      ...approval,
      riskSnapshot: approval.riskSnapshot ?? null,
      expiresAt: approval.expiresAt ? new Date(approval.expiresAt) : null,
    },
  }))

const actionLedgerApprovalDecisionStatusValues = [
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
] as const

const actionLedgerApprovalDecisionActionBodySchema = z.object({
  actionName: z.string().trim().min(1),
  actionVersion: z.string().trim().min(1).default("v1"),
  actorType: nullableTrimmedString,
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string().trim().min(1),
  principalSubtype: nullableTrimmedString,
  sessionId: nullableTrimmedString,
  apiTokenId: nullableTrimmedString,
  internalRequest: z.boolean().default(false),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
  delegatedByPrincipalId: nullableTrimmedString,
  delegationId: nullableTrimmedString,
  callerType: nullableTrimmedString,
  organizationId: nullableTrimmedString,
  routeOrToolName: nullableTrimmedString,
  workflowRunId: nullableTrimmedString,
  workflowStepId: nullableTrimmedString,
  correlationId: nullableTrimmedString,
  idempotencyScope: nullableTrimmedString,
  idempotencyKey: nullableTrimmedString,
  idempotencyFingerprint: nullableTrimmedString,
  capabilityId: nullableTrimmedString,
  capabilityVersion: nullableTrimmedString,
  authorizationSource: nullableTrimmedString,
  amendsActionId: nullableTrimmedString,
})

export const decideActionApprovalBodySchema = z
  .object({
    status: z.enum(actionLedgerApprovalDecisionStatusValues),
    decidedByPrincipalId: z.string().trim().min(1),
    decidedAt: z.string().datetime().optional(),
    decisionAction: actionLedgerApprovalDecisionActionBodySchema,
  })
  .transform(({ decidedAt, ...body }) => ({
    ...body,
    decidedAt: decidedAt ? new Date(decidedAt) : undefined,
  }))

const actionLedgerReversalActionBodySchema = z.object({
  actionName: z.string().trim().min(1),
  actionVersion: z.string().trim().min(1).default("v1"),
  actionKind: z.enum(["reverse", "compensate"]),
  status: z.enum(["reversed", "compensated", "failed"]),
  evaluatedRisk: z.enum(actionLedgerRiskValues).default("high"),
  actorType: nullableTrimmedString,
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string().trim().min(1),
  principalSubtype: nullableTrimmedString,
  sessionId: nullableTrimmedString,
  apiTokenId: nullableTrimmedString,
  internalRequest: z.boolean().default(false),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
  delegatedByPrincipalId: nullableTrimmedString,
  delegationId: nullableTrimmedString,
  callerType: nullableTrimmedString,
  organizationId: nullableTrimmedString,
  routeOrToolName: nullableTrimmedString,
  workflowRunId: nullableTrimmedString,
  workflowStepId: nullableTrimmedString,
  correlationId: nullableTrimmedString,
  idempotencyScope: nullableTrimmedString,
  idempotencyKey: nullableTrimmedString,
  idempotencyFingerprint: nullableTrimmedString,
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  capabilityId: nullableTrimmedString,
  capabilityVersion: nullableTrimmedString,
  authorizationSource: nullableTrimmedString,
  approvalId: nullableTrimmedString,
  amendsActionId: nullableTrimmedString,
  mutationDetail: z
    .object({
      commandInputRef: nullableTrimmedString,
      commandResultRef: nullableTrimmedString,
      summary: nullableTrimmedString,
      reversalKind: z.enum(actionLedgerReversalKindValues).default("none"),
      reversalCommandId: nullableTrimmedString,
      reversalCommandVersion: nullableTrimmedString,
      reversalArgsRef: nullableTrimmedString,
    })
    .optional(),
})

export const recordActionLedgerReversalBodySchema = z.object({
  reversalAction: actionLedgerReversalActionBodySchema,
  projection: z
    .object({
      reversalState: z.enum(actionLedgerReversalStateValues).optional(),
      reversalOutcome: z.enum(actionLedgerReversalOutcomeValues).optional(),
    })
    .optional(),
})

export const actionDelegationListQuerySchema = z
  .object({
    rootPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    rootPrincipalId: z.string().trim().min(1).optional(),
    parentPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    parentPrincipalId: z.string().trim().min(1).optional(),
    childPrincipalType: z.enum(actionLedgerPrincipalTypeValues).optional(),
    childPrincipalId: z.string().trim().min(1).optional(),
    grantSource: z.string().trim().min(1).optional(),
    capabilityScopeRef: z.string().trim().min(1).optional(),
    budgetScopeRef: z.string().trim().min(1).optional(),
    expiresAtFrom: z.string().datetime().optional(),
    expiresAtTo: z.string().datetime().optional(),
    createdAtFrom: z.string().datetime().optional(),
    createdAtTo: z.string().datetime().optional(),
    cursorCreatedAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorCreatedAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorCreatedAt ? ["cursorId"] : ["cursorCreatedAt"],
      message: "cursorCreatedAt and cursorId must be provided together",
    })
  })
  .transform(
    ({
      cursorCreatedAt,
      cursorId,
      expiresAtFrom,
      expiresAtTo,
      createdAtFrom,
      createdAtTo,
      ...query
    }) => ({
      ...query,
      expiresAtFrom: expiresAtFrom ? new Date(expiresAtFrom) : undefined,
      expiresAtTo: expiresAtTo ? new Date(expiresAtTo) : undefined,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      cursor:
        cursorCreatedAt && cursorId
          ? {
              createdAt: cursorCreatedAt,
              id: cursorId,
            }
          : undefined,
    }),
  )
