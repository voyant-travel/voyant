import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyantjs/action-ledger"
import type { z } from "zod"

import type {
  creditNoteLineItems,
  creditNotes,
  invoiceLineItems,
  invoices,
  payments,
} from "./schema.js"
import type {
  updateCreditNoteSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceSchema,
} from "./validation.js"

type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
type UpdateInvoiceLineItemInput = z.infer<typeof updateInvoiceLineItemSchema>
type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>

type InvoiceRecord = typeof invoices.$inferSelect
type PaymentRecord = typeof payments.$inferSelect
type CreditNoteRecord = typeof creditNotes.$inferSelect
type InvoiceLineItemRecord = typeof invoiceLineItems.$inferSelect
type CreditNoteLineItemRecord = typeof creditNoteLineItems.$inferSelect

type RecordPaymentLedgerInput = {
  invoice: InvoiceRecord
  payment: PaymentRecord
}
type InvoiceIssuedLedgerInput = {
  invoice: InvoiceRecord
}
type InvoiceUpdateLedgerInput = {
  invoice: InvoiceRecord
  changes: UpdateInvoiceInput
}
type InvoiceDeleteLedgerInput = {
  invoice: InvoiceRecord
}
type InvoiceLineItemMutationLedgerInput = {
  invoice: InvoiceRecord
  lineItem: InvoiceLineItemRecord
  changes?: UpdateInvoiceLineItemInput
}
type CreateCreditNoteLedgerInput = {
  invoice: InvoiceRecord
  creditNote: CreditNoteRecord
}
type CreditNoteUpdateLedgerInput = {
  invoice: InvoiceRecord
  creditNote: CreditNoteRecord
  changes: UpdateCreditNoteInput
}
type CreditNoteLineItemCreateLedgerInput = {
  invoice: InvoiceRecord
  creditNote: CreditNoteRecord
  lineItem: CreditNoteLineItemRecord
}

export async function buildRecordPaymentActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: RecordPaymentLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const idempotencyKey =
    input.payment.referenceNumber ??
    input.payment.paymentCaptureId ??
    input.payment.paymentAuthorizationId ??
    null
  const idempotencyFingerprint = idempotencyKey
    ? await buildIdempotencyFingerprint({
        actionName: "finance.payment.record",
        actionVersion: "v1",
        targetType: target.type,
        targetId: target.id,
        commandInput: {
          invoiceId: input.invoice.id,
          paymentId: input.payment.id,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency,
          paymentMethod: input.payment.paymentMethod,
          paymentDate: input.payment.paymentDate,
          referenceNumber: input.payment.referenceNumber,
          paymentAuthorizationId: input.payment.paymentAuthorizationId,
          paymentCaptureId: input.payment.paymentCaptureId,
        },
      })
    : null

  return {
    context,
    actionName: "finance.payment.record",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment.record",
    authorizationSource: options.authorizationSource ?? "finance.payment.route",
    idempotencyScope: idempotencyKey ? `finance.invoice:${input.invoice.id}:payment` : null,
    idempotencyKey,
    idempotencyFingerprint,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:payment`,
      commandResultRef: `payment:${input.payment.id}`,
      summary: `Payment ${input.payment.id} recorded for invoice ${input.invoice.id}`,
      reversalKind: "none",
    },
  }
}

function getInvoiceLedgerTarget(invoice: InvoiceRecord) {
  if (invoice.bookingId) return { type: "booking", id: invoice.bookingId }
  return { type: "invoice", id: invoice.id }
}

export async function buildInvoiceIssuedActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceIssuedLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const invoiceTypeLabel = input.invoice.invoiceType === "proforma" ? "Proforma" : "Invoice"

  return {
    context,
    actionName: "finance.invoice.issue_from_booking",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.issue_from_booking",
    authorizationSource: options.authorizationSource ?? "finance.invoice.from_booking.route",
    idempotencyScope: `finance.booking:${input.invoice.bookingId}:invoice_issue`,
    idempotencyKey: input.invoice.invoiceNumber,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "finance.invoice.issue_from_booking",
      actionVersion: "v1",
      targetType: target.type,
      targetId: target.id,
      commandInput: {
        invoiceId: input.invoice.id,
        invoiceNumber: input.invoice.invoiceNumber,
        invoiceType: input.invoice.invoiceType,
        bookingId: input.invoice.bookingId,
        totalCents: input.invoice.totalCents,
        currency: input.invoice.currency,
        status: input.invoice.status,
        issueDate: input.invoice.issueDate,
        dueDate: input.invoice.dueDate,
      },
    }),
    mutationDetail: {
      commandInputRef: `booking:${input.invoice.bookingId}:invoice_issue`,
      commandResultRef: `invoice:${input.invoice.id}`,
      summary: `${invoiceTypeLabel} ${input.invoice.invoiceNumber} issued for booking ${input.invoice.bookingId}`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.invoice.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.update",
    authorizationSource: options.authorizationSource ?? "finance.invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:update`,
      commandResultRef: `invoice:${input.invoice.id}`,
      summary: `Invoice ${input.invoice.invoiceNumber} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice.delete",
    authorizationSource: options.authorizationSource ?? "finance.invoice.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:delete`,
      commandResultRef: null,
      summary: `Draft invoice ${input.invoice.invoiceNumber} deleted`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice_line_item.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.create",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:line_item`,
      commandResultRef: `invoice_line_item:${input.lineItem.id}`,
      summary: `Line item ${input.lineItem.id} added to invoice ${input.invoice.invoiceNumber}`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)
  const changedFields = Object.keys(input.changes ?? {}).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.invoice_line_item.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.update",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice_line_item:${input.lineItem.id}:update`,
      commandResultRef: `invoice_line_item:${input.lineItem.id}`,
      summary: `Line item ${input.lineItem.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildInvoiceLineItemDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: InvoiceLineItemMutationLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.invoice_line_item.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.invoice_line_item.delete",
    authorizationSource: options.authorizationSource ?? "finance.invoice_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `invoice_line_item:${input.lineItem.id}:delete`,
      commandResultRef: null,
      summary: `Line item ${input.lineItem.id} deleted from invoice ${input.invoice.invoiceNumber}`,
      reversalKind: "none",
    },
  }
}

export async function buildCreditNoteCreationActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CreateCreditNoteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getInvoiceLedgerTarget(input.invoice)
  const idempotencyKey = input.creditNote.creditNoteNumber

  return {
    context,
    actionName: "finance.credit_note.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.credit_note.create",
    authorizationSource: options.authorizationSource ?? "finance.credit_note.route",
    idempotencyScope: `finance.invoice:${input.invoice.id}:credit_note`,
    idempotencyKey,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "finance.credit_note.create",
      actionVersion: "v1",
      targetType: target.type,
      targetId: target.id,
      commandInput: {
        invoiceId: input.invoice.id,
        creditNoteId: input.creditNote.id,
        creditNoteNumber: input.creditNote.creditNoteNumber,
        amountCents: input.creditNote.amountCents,
        currency: input.creditNote.currency,
        status: input.creditNote.status,
        reason: input.creditNote.reason,
      },
    }),
    mutationDetail: {
      commandInputRef: `invoice:${input.invoice.id}:credit_note`,
      commandResultRef: `credit_note:${input.creditNote.id}`,
      summary: `Credit note ${input.creditNote.creditNoteNumber} created for invoice ${input.invoice.id}`,
      reversalKind: "none",
    },
  }
}

export function buildCreditNoteUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CreditNoteUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.credit_note.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.credit_note.update",
    authorizationSource: options.authorizationSource ?? "finance.credit_note.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `credit_note:${input.creditNote.id}:update`,
      commandResultRef: `credit_note:${input.creditNote.id}`,
      summary: `Credit note ${input.creditNote.creditNoteNumber} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildCreditNoteLineItemCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CreditNoteLineItemCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getInvoiceLedgerTarget(input.invoice)

  return {
    context,
    actionName: "finance.credit_note_line_item.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.credit_note_line_item.create",
    authorizationSource: options.authorizationSource ?? "finance.credit_note_line_item.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `credit_note:${input.creditNote.id}:line_item`,
      commandResultRef: `credit_note_line_item:${input.lineItem.id}`,
      summary: `Line item ${input.lineItem.id} added to credit note ${input.creditNote.creditNoteNumber}`,
      reversalKind: "none",
    },
  }
}
