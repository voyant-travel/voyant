import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyantjs/action-ledger"
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

export async function buildSupplierPaymentCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: SupplierPaymentCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const idempotencyKey = input.payment.referenceNumber

  return {
    context,
    actionName: "finance.supplier_payment.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: "booking",
    targetId: input.payment.bookingId,
    routeOrToolName: "finance.supplier_payment.create",
    authorizationSource: options.authorizationSource ?? "finance.supplier_payment.route",
    idempotencyScope: idempotencyKey
      ? `finance.booking:${input.payment.bookingId}:supplier_payment`
      : null,
    idempotencyKey,
    idempotencyFingerprint: idempotencyKey
      ? await buildIdempotencyFingerprint({
          actionName: "finance.supplier_payment.create",
          actionVersion: "v1",
          targetType: "booking",
          targetId: input.payment.bookingId,
          commandInput: {
            supplierPaymentId: input.payment.id,
            bookingId: input.payment.bookingId,
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
      commandInputRef: `booking:${input.payment.bookingId}:supplier_payment`,
      commandResultRef: `supplier_payment:${input.payment.id}`,
      summary: `Supplier payment ${input.payment.id} recorded for booking ${input.payment.bookingId}`,
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

  return {
    context,
    actionName: "finance.supplier_payment.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: "booking",
    targetId: input.payment.bookingId,
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
