import type { ActionApproval } from "../schema.js"
import { ActionApprovalDecisionStatusError } from "./errors.js"
import type { ApprovalDecisionStatus } from "./types.js"

const approvalDecisionStatusValues = [
  "approved",
  "denied",
  "expired",
  "cancelled",
  "superseded",
] as const satisfies readonly ApprovalDecisionStatus[]

const approvalDecisionStatusSet = new Set<ActionApproval["status"]>(approvalDecisionStatusValues)

export function assertApprovalDecisionStatus(
  status: string,
): asserts status is ApprovalDecisionStatus {
  if (approvalDecisionStatusSet.has(status as ActionApproval["status"])) return
  throw new ActionApprovalDecisionStatusError(status)
}
