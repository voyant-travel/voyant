import {
  buildActionLedgerApprovedExecutionFields,
  type ActionLedgerRequestContextValues,
} from "@voyant-travel/action-ledger"
import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import type { Context } from "hono"

import {
  authorizeFinanceRefund,
  FINANCE_REFUND_ACTION_NAME,
  FINANCE_REFUND_CAPABILITY,
  FINANCE_REFUND_ROUTE_OR_TOOL_NAME,
} from "./refund-authorization.js"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["finance"],
  contribute: ({ context, request }) => {
    const c = request as Context<Env>
    const db = context.db as Parameters<typeof financeService.listInvoices>[0]
    return {
      finance: {
        listInvoices: (query: Parameters<typeof financeService.listInvoices>[1]) =>
          financeService.listInvoices(db, query),
        getInvoiceById: (id: string) => financeService.getInvoiceById(db, id),
        getFinanceAggregates: (query: Parameters<typeof financeService.getFinanceAggregates>[1]) =>
          financeService.getFinanceAggregates(db, query),
        voidInvoice: (id: string, input: { reason?: string }) =>
          financeService.voidInvoice(db, id, input),
        async issueInvoiceRefund(input: {
          invoiceId: string
          creditNoteNumber: string
          amountCents: number
          currency: string
          baseCurrency?: string | null
          baseAmountCents?: number | null
          fxRateSetId?: string | null
          reason: string
          notes?: string | null
          idempotencyKey: string
          approvalId?: string
        }) {
          const command = {
            creditNoteNumber: input.creditNoteNumber,
            status: "issued" as const,
            amountCents: input.amountCents,
            currency: input.currency,
            baseCurrency: input.baseCurrency,
            baseAmountCents: input.baseAmountCents,
            fxRateSetId: input.fxRateSetId,
            reason: input.reason,
            notes: input.notes,
          }
          const requestContext = financeToolActionLedgerContext(c)
          const authorization = await authorizeFinanceRefund({
            db,
            invoiceId: input.invoiceId,
            commandInput: command,
            actor: c.get("actor"),
            callerType: c.get("callerType"),
            scopes: c.get("scopes"),
            isInternalRequest: c.get("isInternalRequest"),
            requestContext,
            approvalId: input.approvalId ?? null,
            idempotencyKey: input.idempotencyKey,
          })

          if (authorization.status === "approval_required") {
            return {
              status: "approval_required" as const,
              requestedAction: {
                id: authorization.requestedAction.id,
                status: authorization.requestedAction.status,
                actionName: authorization.requestedAction.actionName,
                targetType: authorization.requestedAction.targetType,
                targetId: authorization.requestedAction.targetId,
              },
              approval: {
                id: authorization.approval.id,
                status: authorization.approval.status,
                requestedActionId: authorization.approval.requestedActionId,
                policyName: authorization.approval.policyName,
                policyVersion: authorization.approval.policyVersion,
                riskSnapshot: authorization.approval.riskSnapshot,
                reasonCode: authorization.approval.reasonCode,
                expiresAt: toIsoString(authorization.approval.expiresAt),
                createdAt: toIsoString(authorization.approval.createdAt),
              },
              replayed: authorization.replayed,
            }
          }
          if (authorization.status !== "authorized") {
            throw financeRefundAuthorizationError(authorization)
          }

          const approved = buildActionLedgerApprovedExecutionFields(authorization.approvedAction)
          const creditNote = await financeService.createCreditNote(db, input.invoiceId, command, {
            eventBus: c.get("eventBus"),
            actionLedgerContext: requestContext,
            actionLedgerAuthorizationSource: authorization.access.authorizationSource,
            actionLedgerActionName: FINANCE_REFUND_ACTION_NAME,
            actionLedgerRouteOrToolName: FINANCE_REFUND_ROUTE_OR_TOOL_NAME,
            actionLedgerTargetType: "invoice",
            actionLedgerTargetId: input.invoiceId,
            actionLedgerCapabilityId: FINANCE_REFUND_CAPABILITY.id,
            actionLedgerCapabilityVersion: FINANCE_REFUND_CAPABILITY.version,
            actionLedgerEvaluatedRisk: FINANCE_REFUND_CAPABILITY.risk,
            actionLedgerCausationActionId: approved.causationActionId,
            actionLedgerApprovalId: approved.approvalId,
            actionLedgerIdempotencyScope: approved.idempotencyScope,
            actionLedgerIdempotencyKey: approved.idempotencyKey,
            actionLedgerIdempotencyFingerprint: approved.idempotencyFingerprint,
          })
          if (!creditNote) {
            throw new ToolError(`Invoice "${input.invoiceId}" was not found.`, "NOT_FOUND", {
              invoiceId: input.invoiceId,
            })
          }
          return {
            status: "issued" as const,
            creditNote: toJsonValue(creditNote),
          }
        },
      },
    }
  },
})

function financeToolActionLedgerContext(c: Context<Env>): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}

function financeRefundAuthorizationError(
  result: Exclude<
    Awaited<ReturnType<typeof authorizeFinanceRefund>>,
    { status: "authorized" | "approval_required" }
  >,
) {
  switch (result.status) {
    case "denied":
      return new ToolError("Invoice refund is not authorized.", "AUTHORIZATION_DENIED", {
        reason: result.access.reason,
      })
    case "missing_idempotency_key":
      return new ToolError("Invoice refund requires an idempotency key.", "INVALID_INPUT")
    case "idempotency_conflict":
      return new ToolError(result.message, "INVALID_INPUT", {
        existingActionId: result.existingActionId,
      })
    case "invalid_approval":
      return new ToolError(
        "The approval does not authorize this exact invoice credit-note refund.",
        "INVALID_INPUT",
        {
          reason: result.validation.reason,
          approvalId: result.validation.approval?.id,
        },
      )
  }
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}
