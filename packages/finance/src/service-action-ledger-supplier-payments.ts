import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyant-travel/action-ledger"
import type { z } from "zod"

import type { supplierPayments } from "./schema.js"
import type { updateSupplierPaymentSchema } from "./validation.js"

type UpdateSupplierPaymentInput = z.infer<typeof updateSupplierPaymentSchema>
type SupplierPaymentRecord = typeof supplierPayments.$inferSelect

type SupplierPaymentCreateLedgerInput = {
  payment: SupplierPaymentRecord
}
type SupplierPaymentUpdateLedgerInput = {
  payment: SupplierPaymentRecord
  changes: UpdateSupplierPaymentInput
}

/**
 * AP payments may settle a whole supplier invoice (no booking) or a
 * booking-scoped supplier service. The ledger targets the booking when present,
 * otherwise the supplier invoice (§5.4).
 */
function resolvePaymentTarget(payment: SupplierPaymentRecord): {
  targetType: string
  targetId: string
  scopeRef: string
} {
  if (payment.bookingId) {
    return {
      targetType: "booking",
      targetId: payment.bookingId,
      scopeRef: `booking:${payment.bookingId}`,
    }
  }
  if (payment.supplierInvoiceId) {
    return {
      targetType: "supplier_invoice",
      targetId: payment.supplierInvoiceId,
      scopeRef: `supplier_invoice:${payment.supplierInvoiceId}`,
    }
  }
  return {
    targetType: "supplier_payment",
    targetId: payment.id,
    scopeRef: `supplier_payment:${payment.id}`,
  }
}

export async function buildSupplierPaymentCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: SupplierPaymentCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const idempotencyKey = input.payment.referenceNumber
  const { targetType, targetId, scopeRef } = resolvePaymentTarget(input.payment)

  return {
    context,
    actionName: "finance.supplier_payment.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType,
    targetId,
    routeOrToolName: "finance.supplier_payment.create",
    authorizationSource: options.authorizationSource ?? "finance.supplier_payment.route",
    idempotencyScope: idempotencyKey ? `finance.${scopeRef}:supplier_payment` : null,
    idempotencyKey,
    idempotencyFingerprint: idempotencyKey
      ? await buildIdempotencyFingerprint({
          actionName: "finance.supplier_payment.create",
          actionVersion: "v1",
          targetType,
          targetId,
          commandInput: {
            supplierPaymentId: input.payment.id,
            bookingId: input.payment.bookingId,
            supplierInvoiceId: input.payment.supplierInvoiceId,
            supplierId: input.payment.supplierId,
            amountCents: input.payment.amountCents,
            currency: input.payment.currency,
            paymentMethod: input.payment.paymentMethod,
            paymentDate: input.payment.paymentDate,
            referenceNumber: input.payment.referenceNumber,
            status: input.payment.status,
          },
        })
      : null,
    mutationDetail: {
      commandInputRef: `${scopeRef}:supplier_payment`,
      commandResultRef: `supplier_payment:${input.payment.id}`,
      summary: `Supplier payment ${input.payment.id} recorded against ${scopeRef}`,
      reversalKind: "none",
    },
  }
}

export function buildSupplierPaymentUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: SupplierPaymentUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"
  const { targetType, targetId } = resolvePaymentTarget(input.payment)

  return {
    context,
    actionName: "finance.supplier_payment.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType,
    targetId,
    routeOrToolName: "finance.supplier_payment.update",
    authorizationSource: options.authorizationSource ?? "finance.supplier_payment.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `supplier_payment:${input.payment.id}:update`,
      commandResultRef: `supplier_payment:${input.payment.id}`,
      summary: `Supplier payment ${input.payment.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}
