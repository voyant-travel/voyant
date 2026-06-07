import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyantjs/action-ledger"

import type { supplierInvoices } from "./schema.js"

type SupplierInvoiceRecord = typeof supplierInvoices.$inferSelect

const TARGET_TYPE = "supplier_invoice"

export async function buildSupplierInvoiceCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: { invoice: SupplierInvoiceRecord },
  options: { authorizationSource?: string | null } = {},
): Promise<BuildActionLedgerMutationInput> {
  const idempotencyKey = `${input.invoice.supplierId}:${input.invoice.supplierInvoiceNo}`

  return {
    context,
    actionName: "finance.supplier_invoice.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: TARGET_TYPE,
    targetId: input.invoice.id,
    routeOrToolName: "finance.supplier_invoice.create",
    authorizationSource: options.authorizationSource ?? "finance.supplier_invoice.route",
    idempotencyScope: `finance.supplier:${input.invoice.supplierId}:supplier_invoice`,
    idempotencyKey,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "finance.supplier_invoice.create",
      actionVersion: "v1",
      targetType: TARGET_TYPE,
      targetId: input.invoice.id,
      commandInput: {
        supplierInvoiceId: input.invoice.id,
        supplierId: input.invoice.supplierId,
        supplierInvoiceNo: input.invoice.supplierInvoiceNo,
        currency: input.invoice.currency,
        totalCents: input.invoice.totalCents,
        issueDate: input.invoice.issueDate,
        status: input.invoice.status,
      },
    }),
    mutationDetail: {
      commandInputRef: `supplier:${input.invoice.supplierId}:supplier_invoice`,
      commandResultRef: `supplier_invoice:${input.invoice.id}`,
      summary: `Supplier invoice ${input.invoice.supplierInvoiceNo} recorded for supplier ${input.invoice.supplierId}`,
      reversalKind: "domain_command",
    },
  }
}

export function buildSupplierInvoiceUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: { invoice: SupplierInvoiceRecord; changes: Record<string, unknown> },
  options: { authorizationSource?: string | null } = {},
): BuildActionLedgerMutationInput {
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.supplier_invoice.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: TARGET_TYPE,
    targetId: input.invoice.id,
    routeOrToolName: "finance.supplier_invoice.update",
    authorizationSource: options.authorizationSource ?? "finance.supplier_invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `supplier_invoice:${input.invoice.id}:update`,
      commandResultRef: `supplier_invoice:${input.invoice.id}`,
      summary: `Supplier invoice ${input.invoice.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildSupplierInvoiceDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: { invoice: SupplierInvoiceRecord },
  options: { authorizationSource?: string | null } = {},
): BuildActionLedgerMutationInput {
  return {
    context,
    actionName: "finance.supplier_invoice.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: TARGET_TYPE,
    targetId: input.invoice.id,
    routeOrToolName: "finance.supplier_invoice.delete",
    authorizationSource: options.authorizationSource ?? "finance.supplier_invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `supplier_invoice:${input.invoice.id}:delete`,
      commandResultRef: `supplier_invoice:${input.invoice.id}`,
      summary: `Supplier invoice ${input.invoice.id} deleted`,
      reversalKind: "none",
    },
  }
}

export function buildSupplierInvoiceAllocationsActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: { invoice: SupplierInvoiceRecord; allocationCount: number },
  options: { authorizationSource?: string | null } = {},
): BuildActionLedgerMutationInput {
  return {
    context,
    actionName: "finance.supplier_invoice.set_allocations",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: TARGET_TYPE,
    targetId: input.invoice.id,
    routeOrToolName: "finance.supplier_invoice.set_allocations",
    authorizationSource: options.authorizationSource ?? "finance.supplier_invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `supplier_invoice:${input.invoice.id}:allocations`,
      commandResultRef: `supplier_invoice:${input.invoice.id}`,
      summary: `Supplier invoice ${input.invoice.id} allocations set (${input.allocationCount})`,
      reversalKind: "none",
    },
  }
}
