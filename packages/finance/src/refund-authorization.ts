/** Approval orchestration for issuing an invoice credit note as a refund. */

import {
  type ActionLedgerCapabilityAccessResult,
  type ActionLedgerCapabilityDefinition,
  type ActionLedgerRequestContextValues,
  ActionLedgerIdempotencyConflictError,
  actionLedgerService,
  appendActionLedgerMutation,
  type BuildActionLedgerApprovedExecutionFieldsInput,
  buildActionApprovalCommandFingerprint,
  evaluateActionLedgerApprovalRequirement,
  evaluateActionLedgerCapabilityAccess,
  mapActionLedgerRequestContext,
  requestActionLedgerApproval,
} from "@voyant-travel/action-ledger"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { financeService } from "./service.js"

export const FINANCE_REFUND_CAPABILITY = {
  id: "finance:refund",
  version: "v1",
  resource: "invoice",
  action: "refund",
  risk: "critical",
  ledgerPolicy: "required",
  approvalPolicy: "required",
  reversible: false,
  allowedActorTypes: ["staff", "system"],
  requiredGrants: [{ resource: "finance", action: "refund" }],
} as const satisfies ActionLedgerCapabilityDefinition

export const FINANCE_REFUND_APPROVAL_POLICY = "finance-credit-note-refund-approval-v1"
export const FINANCE_REFUND_ACTION_NAME = "finance.credit_note.issue_refund"
export const FINANCE_REFUND_ROUTE_OR_TOOL_NAME = "finance.issue_invoice_refund"

export interface FinanceRefundAuthorizationInput {
  db: PostgresJsDatabase
  invoiceId: string
  commandInput: unknown
  actor?: string | null
  callerType?: string | null
  scopes?: readonly string[] | null
  isInternalRequest?: boolean | null
  requestContext: ActionLedgerRequestContextValues
  approvalId?: string | null
  idempotencyKey?: string | null
}

export type FinanceRefundAuthorizationResult =
  | {
      status: "authorized"
      access: ActionLedgerCapabilityAccessResult
      approvedAction: BuildActionLedgerApprovedExecutionFieldsInput
    }
  | {
      status: "approval_required"
      access: ActionLedgerCapabilityAccessResult
      requestedAction: Awaited<ReturnType<typeof requestActionLedgerApproval>>["requestedAction"]
      approval: Awaited<ReturnType<typeof requestActionLedgerApproval>>["approval"]
      replayed: boolean
    }
  | { status: "denied"; access: ActionLedgerCapabilityAccessResult }
  | { status: "missing_idempotency_key"; access: ActionLedgerCapabilityAccessResult }
  | {
      status: "idempotency_conflict"
      access: ActionLedgerCapabilityAccessResult
      message: string
      existingActionId: string
    }
  | {
      status: "invalid_approval"
      access: ActionLedgerCapabilityAccessResult
      validation: Exclude<
        Awaited<ReturnType<typeof actionLedgerService.validateApprovedAction>>,
        { ok: true }
      >
    }

export async function authorizeFinanceRefund(
  input: FinanceRefundAuthorizationInput,
): Promise<FinanceRefundAuthorizationResult> {
  const access = evaluateActionLedgerCapabilityAccess({
    definition: FINANCE_REFUND_CAPABILITY,
    actor: input.actor,
    callerType: input.callerType,
    scopes: input.scopes,
    isInternalRequest: input.isInternalRequest,
  })
  if (!access.allowed) {
    await appendActionLedgerMutation(input.db, {
      context: input.requestContext,
      actionName: FINANCE_REFUND_ACTION_NAME,
      actionVersion: FINANCE_REFUND_CAPABILITY.version,
      actionKind: "create",
      status: "denied",
      evaluatedRisk: access.evaluatedRisk,
      targetType: "invoice",
      targetId: input.invoiceId,
      routeOrToolName: FINANCE_REFUND_ROUTE_OR_TOOL_NAME,
      capabilityId: access.capabilityId,
      capabilityVersion: access.capabilityVersion,
      authorizationSource: access.authorizationSource,
      mutationDetail: {
        summary: `Invoice refund denied: ${access.reason}`,
        reversalKind: "none",
      },
    })
    return { status: "denied", access }
  }

  const approvalRequirement = evaluateActionLedgerApprovalRequirement({
    access,
    conditionalApprovalRequired: true,
    reasonCode: "invoice_credit_note_refund_requested_by_agent",
  })
  const targetState = await loadInvoiceRefundTargetState(input.db, input.invoiceId)
  const fingerprint = await buildActionApprovalCommandFingerprint({
    actionName: FINANCE_REFUND_ACTION_NAME,
    actionVersion: FINANCE_REFUND_CAPABILITY.version,
    targetType: "invoice",
    targetId: input.invoiceId,
    commandInput: { command: input.commandInput, targetState },
    approvalPolicy: approvalRequirement.approvalPolicy,
    capabilityId: access.capabilityId,
    capabilityVersion: access.capabilityVersion,
    evaluatedRisk: approvalRequirement.evaluatedRisk,
    reasonCode: approvalRequirement.reasonCode,
  })

  if (input.approvalId) {
    const principal = mapActionLedgerRequestContext(input.requestContext)
    const validation = await actionLedgerService.validateApprovedAction(input.db, {
      approvalId: input.approvalId,
      actionName: FINANCE_REFUND_ACTION_NAME,
      actionVersion: FINANCE_REFUND_CAPABILITY.version,
      requestedActionKind: "create",
      requestedActionStatus: "awaiting_approval",
      targetType: "invoice",
      targetId: input.invoiceId,
      routeOrToolName: FINANCE_REFUND_ROUTE_OR_TOOL_NAME,
      principalType: principal.principalType,
      principalId: principal.principalId,
      idempotencyFingerprint: fingerprint,
      executionActionKind: "create",
      executionStatus: "succeeded",
    })
    if (!validation.ok) return { status: "invalid_approval", access, validation }
    return {
      status: "authorized",
      access,
      approvedAction: {
        requestedActionId: validation.requestedAction.id,
        approvalId: validation.approval.id,
        idempotencyFingerprint: validation.idempotencyFingerprint,
      },
    }
  }

  if (!input.idempotencyKey) return { status: "missing_idempotency_key", access }

  try {
    const result = await requestActionLedgerApproval(input.db, {
      context: input.requestContext,
      actionName: FINANCE_REFUND_ACTION_NAME,
      actionVersion: FINANCE_REFUND_CAPABILITY.version,
      actionKind: "create",
      evaluatedRisk: approvalRequirement.evaluatedRisk,
      targetType: "invoice",
      targetId: input.invoiceId,
      routeOrToolName: FINANCE_REFUND_ROUTE_OR_TOOL_NAME,
      capabilityId: access.capabilityId,
      capabilityVersion: access.capabilityVersion,
      authorizationSource: access.authorizationSource,
      idempotencyScope: `${FINANCE_REFUND_ROUTE_OR_TOOL_NAME}:${input.invoiceId}`,
      idempotencyKey: input.idempotencyKey,
      idempotencyFingerprint: fingerprint,
      mutationDetail: {
        summary: "Invoice credit-note refund awaiting approval",
        reversalKind: "none",
      },
      approval: {
        policyName: FINANCE_REFUND_APPROVAL_POLICY,
        policyVersion: FINANCE_REFUND_CAPABILITY.version,
        riskSnapshot: approvalRequirement.evaluatedRisk,
        reasonCode: approvalRequirement.reasonCode,
      },
    })
    return {
      status: "approval_required",
      access,
      requestedAction: result.requestedAction,
      approval: result.approval,
      replayed: result.replayed,
    }
  } catch (error) {
    if (error instanceof ActionLedgerIdempotencyConflictError) {
      return {
        status: "idempotency_conflict",
        access,
        message: error.message,
        existingActionId: error.existingActionId,
      }
    }
    throw error
  }
}

async function loadInvoiceRefundTargetState(db: PostgresJsDatabase, invoiceId: string) {
  const invoice = await financeService.getInvoiceById(db, invoiceId)
  if (!invoice) return { exists: false as const }
  return {
    exists: true as const,
    status: invoice.status,
    invoiceType: invoice.invoiceType,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidCents,
    balanceDueCents: invoice.balanceDueCents,
    updatedAt: invoice.updatedAt.toISOString(),
  }
}
