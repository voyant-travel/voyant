import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
  NewActionLedgerEntry,
  NewActionLedgerPayload,
  NewActionMutationDetail,
  NewActionSensitiveReadDetail,
} from "../schema.js"

export interface AppendActionLedgerEntryInput
  extends Omit<NewActionLedgerEntry, "id" | "createdAt" | "occurredAt"> {
  occurredAt?: Date
  mutationDetail?: Omit<NewActionMutationDetail, "actionId">
  sensitiveReadDetail?: Omit<NewActionSensitiveReadDetail, "actionId">
  payloads?: Omit<NewActionLedgerPayload, "id" | "actionId">[]
}

export interface AppendActionLedgerEntryResult {
  entry: ActionLedgerEntry
  replayed: boolean
}

export interface RequestActionApprovalInput {
  requestedAction: Omit<AppendActionLedgerEntryInput, "approvalId" | "status">
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

export interface RequestActionApprovalResult {
  requestedAction: ActionLedgerEntry
  approval: ActionApproval
  replayed: boolean
}

export type ApprovalDecisionStatus = Exclude<ActionApproval["status"], "pending">

export interface DecideActionApprovalInput {
  id: string
  status: ApprovalDecisionStatus
  decidedByPrincipalId: string
  decidedAt?: Date | string | null
  decisionAction: Omit<
    AppendActionLedgerEntryInput,
    | "actionKind"
    | "approvalId"
    | "causationActionId"
    | "evaluatedRisk"
    | "status"
    | "targetId"
    | "targetType"
  > &
    Partial<
      Pick<
        AppendActionLedgerEntryInput,
        "actionKind" | "evaluatedRisk" | "status" | "targetId" | "targetType"
      >
    >
}

export interface DecideActionApprovalResult {
  approval: ActionApproval
  decisionAction: ActionLedgerEntry
}

type ActionLedgerReversalState = NonNullable<ActionMutationDetail["reversalStateProjection"]>
type ActionLedgerReversalOutcome = NonNullable<ActionMutationDetail["reversalOutcomeProjection"]>

export interface RecordActionLedgerReversalInput {
  originalActionId: string
  reversalAction: Omit<AppendActionLedgerEntryInput, "causationActionId" | "mutationDetail"> & {
    mutationDetail?: Omit<NewActionMutationDetail, "actionId" | "reversesActionId">
  }
  projection?: {
    reversalState?: ActionLedgerReversalState | null
    reversalOutcome?: ActionLedgerReversalOutcome | null
  }
}

export interface RecordActionLedgerReversalResult {
  originalAction: ActionLedgerEntry
  originalMutationDetail: ActionMutationDetail
  reversalAction: ActionLedgerEntry
  replayed: boolean
}

export interface ActionLedgerListCursor {
  occurredAt: string
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
  targetIds?: string[] | null
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
  sortDir?: "asc" | "desc"
  limit?: number
}

export interface ListActionLedgerEntriesResult {
  entries: ActionLedgerEntry[]
  nextCursor: ActionLedgerListCursor | null
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

export interface GetActionLedgerEntryResult {
  entry: ActionLedgerEntry
  mutationDetail: ActionMutationDetail | null
  sensitiveReadDetail: ActionSensitiveReadDetail | null
  payloads: ActionLedgerPayload[]
}

export interface GetActionApprovalResult {
  approval: ActionApproval
  requestedAction: GetActionLedgerEntryResult | null
}

export type ValidateApprovedActionFailureReason =
  | "not_found"
  | "not_approved"
  | "expired"
  | "mismatched_action"
  | "already_executed"
  | "missing_fingerprint"
  | "fingerprint_mismatch"
  | "principal_mismatch"
  | "assignee_mismatch"
  | "capability_mismatch"
  | "risk_mismatch"
  | "policy_mismatch"
  | "reason_mismatch"
  | "idempotency_key_mismatch"

export interface ValidateApprovedActionInput {
  approvalId: string
  actionName: string
  actionVersion: string
  requestedActionKind?: ActionLedgerEntry["actionKind"] | null
  requestedActionStatus?: ActionLedgerEntry["status"] | ActionLedgerEntry["status"][] | null
  targetType: string
  targetId: string
  routeOrToolName?: string | null
  principalType?: ActionLedgerEntry["principalType"] | null
  principalId?: string | null
  requireApprovalProvenance?: boolean
  capabilityId?: string | null
  capabilityVersion?: string | null
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"] | null
  policyName?: string | null
  policyVersion?: string | null
  reasonCode?: string | null
  idempotencyKey?: string | null
  idempotencyFingerprint: string
  executionActionKind?: ActionLedgerEntry["actionKind"]
  executionStatus?: ActionLedgerEntry["status"]
  now?: Date | string | null
}

export type ValidateApprovedActionResult =
  | {
      ok: true
      approval: ActionApproval
      requestedAction: ActionLedgerEntry
      idempotencyFingerprint: string
    }
  | {
      ok: false
      reason: ValidateApprovedActionFailureReason
      approval?: ActionApproval
      requestedAction?: ActionLedgerEntry
      status?: ActionApproval["status"]
      existingActionId?: string
    }

export interface GetActionDelegationResult {
  delegation: ActionDelegation
}
