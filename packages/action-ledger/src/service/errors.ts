import type { ActionApproval } from "../schema.js"

export class ActionLedgerIdempotencyConflictError extends Error {
  readonly existingActionId: string

  constructor(existingActionId: string) {
    super("Action ledger idempotency key was reused with a different fingerprint")
    this.name = "ActionLedgerIdempotencyConflictError"
    this.existingActionId = existingActionId
  }
}

export class ActionApprovalDecisionConflictError extends Error {
  readonly approvalId: string
  readonly currentStatus: ActionApproval["status"]

  constructor(approvalId: string, currentStatus: ActionApproval["status"]) {
    super(`Action approval ${approvalId} is already ${currentStatus}`)
    this.name = "ActionApprovalDecisionConflictError"
    this.approvalId = approvalId
    this.currentStatus = currentStatus
  }
}

export class ActionApprovalDecisionStatusError extends Error {
  readonly status: string

  constructor(status: string) {
    super(`Action approval decision status must be terminal, received ${status}`)
    this.name = "ActionApprovalDecisionStatusError"
    this.status = status
  }
}

export class ActionLedgerReversalTargetError extends Error {
  readonly actionId: string
  readonly reason: "missing_mutation_detail" | "not_reversible"

  constructor(actionId: string, reason: "missing_mutation_detail" | "not_reversible") {
    super(`Action ledger entry ${actionId} cannot be reversed: ${reason}`)
    this.name = "ActionLedgerReversalTargetError"
    this.actionId = actionId
    this.reason = reason
  }
}
