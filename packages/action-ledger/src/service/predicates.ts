import { and, eq, gt, gte, inArray, lt, lte, or, type SQL, sql } from "drizzle-orm"

import {
  type ActionApproval,
  type ActionLedgerEntry,
  type ActionMutationDetail,
  actionApprovals,
  actionDelegations,
  actionLedgerEntries,
  actionMutationDetails,
  actionSensitiveReadDetails,
} from "../schema.js"
import { parseCursorDate } from "./cursors.js"
import type {
  ActionApprovalListCursor,
  ActionDelegationListCursor,
  ActionLedgerListCursor,
  ListActionApprovalsInput,
  ListActionDelegationsInput,
  ListActionLedgerEntriesInput,
} from "./types.js"

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

function buildCursorCondition(
  cursor: ActionLedgerListCursor,
  sortDir: "asc" | "desc" = "desc",
): SQL {
  const occurredAt = parseCursorDate(cursor.occurredAt)
  const compare = sortDir === "asc" ? gt : lt
  const tieBreaker = and(
    eq(actionLedgerEntries.occurredAt, occurredAt),
    compare(actionLedgerEntries.id, cursor.id),
  )

  return or(compare(actionLedgerEntries.occurredAt, occurredAt), tieBreaker) as SQL
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
  if (input.targetIds && input.targetIds.length > 0) {
    conditions.push(inArray(actionLedgerEntries.targetId, input.targetIds))
  }
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
    conditions.push(buildCursorCondition(input.cursor, input.sortDir))
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}

export {
  buildActionApprovalsPredicate,
  buildActionDelegationsPredicate,
  buildActionLedgerEntriesPredicate,
}
