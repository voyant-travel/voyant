import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyantjs/action-ledger"
import type { z } from "zod"

import type {
  bookingGuarantees,
  bookingPaymentSchedules,
  creditNoteLineItems,
  creditNotes,
  invoiceLineItems,
  invoices,
  paymentAuthorizations,
  paymentCaptures,
  paymentInstruments,
  paymentSessions,
  payments,
  supplierPayments,
} from "./schema.js"
import type {
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  markPaymentSessionRequiresRedirectSchema,
  updateBookingGuaranteeSchema,
  updateBookingPaymentScheduleSchema,
  updateCreditNoteSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceSchema,
  updatePaymentAuthorizationSchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionSchema,
  updateSupplierPaymentSchema,
} from "./validation.js"

type CompletePaymentSessionInput = z.infer<typeof completePaymentSessionSchema>
type UpdatePaymentSessionInput = z.infer<typeof updatePaymentSessionSchema>
type MarkPaymentSessionRequiresRedirectInput = z.infer<
  typeof markPaymentSessionRequiresRedirectSchema
>
type FailPaymentSessionInput = z.infer<typeof failPaymentSessionSchema>
type CancelPaymentSessionInput = z.infer<typeof cancelPaymentSessionSchema>
type ExpirePaymentSessionInput = z.infer<typeof expirePaymentSessionSchema>
type UpdatePaymentInstrumentInput = z.infer<typeof updatePaymentInstrumentSchema>
type UpdatePaymentAuthorizationInput = z.infer<typeof updatePaymentAuthorizationSchema>
type UpdatePaymentCaptureInput = z.infer<typeof updatePaymentCaptureSchema>
type UpdateBookingPaymentScheduleInput = z.infer<typeof updateBookingPaymentScheduleSchema>
type UpdateBookingGuaranteeInput = z.infer<typeof updateBookingGuaranteeSchema>
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
type UpdateInvoiceLineItemInput = z.infer<typeof updateInvoiceLineItemSchema>
type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>
type UpdateSupplierPaymentInput = z.infer<typeof updateSupplierPaymentSchema>

type PaymentSessionRecord = typeof paymentSessions.$inferSelect
type PaymentInstrumentRecord = typeof paymentInstruments.$inferSelect
type PaymentAuthorizationRecord = typeof paymentAuthorizations.$inferSelect
type PaymentCaptureRecord = typeof paymentCaptures.$inferSelect
type BookingPaymentScheduleRecord = typeof bookingPaymentSchedules.$inferSelect
type BookingGuaranteeRecord = typeof bookingGuarantees.$inferSelect
type InvoiceRecord = typeof invoices.$inferSelect
type PaymentRecord = typeof payments.$inferSelect
type CreditNoteRecord = typeof creditNotes.$inferSelect
type CreatePaymentSessionLedgerInput = {
  session: PaymentSessionRecord
}
type CompletePaymentSessionLedgerInput = {
  session: PaymentSessionRecord
  status: CompletePaymentSessionInput["status"]
  paymentId: string | null
}
type PaymentSessionUpdateLedgerInput = {
  session: PaymentSessionRecord
  changes: UpdatePaymentSessionInput
}
type PaymentSessionRedirectLedgerInput = {
  session: PaymentSessionRecord
  changes: MarkPaymentSessionRequiresRedirectInput
}
type PaymentSessionFailedLedgerInput = {
  session: PaymentSessionRecord
  changes: FailPaymentSessionInput
}
type PaymentSessionCancelledLedgerInput = {
  session: PaymentSessionRecord
  changes: CancelPaymentSessionInput
}
type PaymentSessionExpiredLedgerInput = {
  session: PaymentSessionRecord
  changes: ExpirePaymentSessionInput
}
type PaymentInstrumentCreateLedgerInput = {
  instrument: PaymentInstrumentRecord
}
type PaymentInstrumentUpdateLedgerInput = {
  instrument: PaymentInstrumentRecord
  changes: UpdatePaymentInstrumentInput
}
type PaymentInstrumentDeleteLedgerInput = {
  instrument: PaymentInstrumentRecord
}
type PaymentAuthorizationCreateLedgerInput = {
  authorization: PaymentAuthorizationRecord
}
type PaymentAuthorizationUpdateLedgerInput = {
  authorization: PaymentAuthorizationRecord
  changes: UpdatePaymentAuthorizationInput
}
type PaymentAuthorizationDeleteLedgerInput = {
  authorization: PaymentAuthorizationRecord
}
type PaymentCaptureCreateLedgerInput = {
  capture: PaymentCaptureRecord
}
type PaymentCaptureUpdateLedgerInput = {
  capture: PaymentCaptureRecord
  changes: UpdatePaymentCaptureInput
}
type PaymentCaptureDeleteLedgerInput = {
  capture: PaymentCaptureRecord
}
type BookingPaymentScheduleCreateLedgerInput = {
  schedule: BookingPaymentScheduleRecord
}
type BookingPaymentScheduleUpdateLedgerInput = {
  schedule: BookingPaymentScheduleRecord
  changes: UpdateBookingPaymentScheduleInput
}
type BookingPaymentScheduleDeleteLedgerInput = {
  schedule: BookingPaymentScheduleRecord
}
type BookingGuaranteeCreateLedgerInput = {
  guarantee: BookingGuaranteeRecord
}
type BookingGuaranteeUpdateLedgerInput = {
  guarantee: BookingGuaranteeRecord
  changes: UpdateBookingGuaranteeInput
}
type BookingGuaranteeDeleteLedgerInput = {
  guarantee: BookingGuaranteeRecord
}
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
type InvoiceLineItemRecord = typeof invoiceLineItems.$inferSelect
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
type CreditNoteLineItemRecord = typeof creditNoteLineItems.$inferSelect
type CreditNoteLineItemCreateLedgerInput = {
  invoice: InvoiceRecord
  creditNote: CreditNoteRecord
  lineItem: CreditNoteLineItemRecord
}
type SupplierPaymentRecord = typeof supplierPayments.$inferSelect
type SupplierPaymentCreateLedgerInput = {
  payment: SupplierPaymentRecord
}
type SupplierPaymentUpdateLedgerInput = {
  payment: SupplierPaymentRecord
  changes: UpdateSupplierPaymentInput
}

export function buildPaymentInstrumentCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentInstrumentCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentInstrumentLedgerTarget(input.instrument)
  const ownerRef = getPaymentInstrumentOwnerRef(input.instrument)

  return {
    context,
    actionName: "finance.payment_instrument.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_instrument.create",
    authorizationSource: options.authorizationSource ?? "finance.payment_instrument.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `${ownerRef}:payment_instrument`,
      commandResultRef: `payment_instrument:${input.instrument.id}`,
      summary: `Payment instrument ${input.instrument.id} created for ${ownerRef}`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentInstrumentUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentInstrumentUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentInstrumentLedgerTarget(input.instrument)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.payment_instrument.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_instrument.update",
    authorizationSource: options.authorizationSource ?? "finance.payment_instrument.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_instrument:${input.instrument.id}:update`,
      commandResultRef: `payment_instrument:${input.instrument.id}`,
      summary: `Payment instrument ${input.instrument.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentInstrumentDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentInstrumentDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentInstrumentLedgerTarget(input.instrument)

  return {
    context,
    actionName: "finance.payment_instrument.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_instrument.delete",
    authorizationSource: options.authorizationSource ?? "finance.payment_instrument.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_instrument:${input.instrument.id}:delete`,
      commandResultRef: null,
      summary: `Payment instrument ${input.instrument.id} deleted`,
      reversalKind: "none",
    },
  }
}

function getPaymentInstrumentLedgerTarget(instrument: PaymentInstrumentRecord) {
  if (instrument.personId) return { type: "person", id: instrument.personId }
  if (instrument.organizationId) return { type: "organization", id: instrument.organizationId }
  if (instrument.supplierId) return { type: "supplier", id: instrument.supplierId }
  if (instrument.channelId) return { type: "channel", id: instrument.channelId }
  return { type: "payment_instrument", id: instrument.id }
}

function getPaymentInstrumentOwnerRef(instrument: PaymentInstrumentRecord) {
  const target = getPaymentInstrumentLedgerTarget(instrument)
  return `${target.type}:${target.id}`
}

export async function buildPaymentSessionCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CreatePaymentSessionLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getPaymentSessionLedgerTarget(input.session)
  const idempotencyKey = input.session.idempotencyKey

  return {
    context,
    actionName: "finance.payment_session.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_session.create",
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
    idempotencyScope:
      idempotencyKey && target.id
        ? `finance.payment_session:${target.type}:${target.id}:create`
        : null,
    idempotencyKey,
    idempotencyFingerprint:
      idempotencyKey && target.id
        ? await buildIdempotencyFingerprint({
            actionName: "finance.payment_session.create",
            actionVersion: "v1",
            targetType: target.type,
            targetId: target.id,
            commandInput: {
              paymentSessionId: input.session.id,
              targetType: input.session.targetType,
              targetId: input.session.targetId,
              amountCents: input.session.amountCents,
              currency: input.session.currency,
              provider: input.session.provider,
              idempotencyKey: input.session.idempotencyKey,
            },
          })
        : null,
    mutationDetail: {
      commandInputRef: target.id
        ? `${target.type}:${target.id}:payment_session`
        : "payment_session:create",
      commandResultRef: `payment_session:${input.session.id}`,
      summary: `Payment session ${input.session.id} created for ${target.type} ${target.id ?? "unknown"}`,
      reversalKind: "none",
    },
  }
}

export async function buildPaymentSessionCompletionActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: CompletePaymentSessionLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getPaymentSessionCompletionLedgerTarget(input.session)
  const idempotencyKey =
    input.session.providerPaymentId ??
    input.session.externalReference ??
    input.session.idempotencyKey ??
    null
  const idempotencyFingerprint = idempotencyKey
    ? await buildIdempotencyFingerprint({
        actionName: "finance.payment_session.complete",
        actionVersion: "v1",
        targetType: target.type,
        targetId: target.id,
        commandInput: {
          paymentSessionId: input.session.id,
          status: input.status,
          providerPaymentId: input.session.providerPaymentId,
          externalReference: input.session.externalReference,
          paymentId: input.paymentId,
        },
      })
    : null

  return {
    context,
    actionName: "finance.payment_session.complete",
    actionVersion: "v1",
    actionKind: "execute",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_session.complete",
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
    idempotencyScope: idempotencyKey
      ? `finance.payment_session:${input.session.id}:complete`
      : null,
    idempotencyKey,
    idempotencyFingerprint,
    mutationDetail: {
      commandInputRef: `payment_session:${input.session.id}:complete`,
      commandResultRef: input.paymentId ? `payment:${input.paymentId}` : null,
      summary: `Payment session ${input.session.id} completed as ${input.status}`,
      reversalKind: "none",
    },
  }
}

function getPaymentSessionCompletionLedgerTarget(session: PaymentSessionRecord) {
  return getPaymentSessionLedgerTarget(session)
}

function getPaymentSessionLedgerTarget(session: PaymentSessionRecord) {
  if (session.bookingId) return { type: "booking", id: session.bookingId }
  if (session.invoiceId) return { type: "invoice", id: session.invoiceId }
  if (session.orderId) return { type: "order", id: session.orderId }
  if (session.targetId && session.targetType !== "other") {
    return { type: session.targetType, id: session.targetId }
  }
  return { type: "payment_session", id: session.id }
}

export function buildPaymentSessionUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentSessionUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentSessionLedgerTarget(input.session)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.payment_session.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_session.update",
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_session:${input.session.id}:update`,
      commandResultRef: `payment_session:${input.session.id}`,
      summary: `Payment session ${input.session.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentSessionRequiresRedirectActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentSessionRedirectLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  return buildPaymentSessionStatusActionLedgerInput(context, {
    session: input.session,
    actionName: "finance.payment_session.requires_redirect",
    actionKind: "update",
    routeOrToolName: "finance.payment_session.requires_redirect",
    commandInputRef: `payment_session:${input.session.id}:requires_redirect`,
    commandResultRef: `payment_session:${input.session.id}`,
    summary: `Payment session ${input.session.id} marked as requiring redirect`,
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
  })
}

export function buildPaymentSessionFailedActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentSessionFailedLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  return buildPaymentSessionStatusActionLedgerInput(context, {
    session: input.session,
    actionName: "finance.payment_session.fail",
    actionKind: "update",
    routeOrToolName: "finance.payment_session.fail",
    commandInputRef: `payment_session:${input.session.id}:fail`,
    commandResultRef: `payment_session:${input.session.id}`,
    summary: `Payment session ${input.session.id} marked as failed`,
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
  })
}

export function buildPaymentSessionCancelledActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentSessionCancelledLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  return buildPaymentSessionStatusActionLedgerInput(context, {
    session: input.session,
    actionName: "finance.payment_session.cancel",
    actionKind: "update",
    routeOrToolName: "finance.payment_session.cancel",
    commandInputRef: `payment_session:${input.session.id}:cancel`,
    commandResultRef: `payment_session:${input.session.id}`,
    summary: `Payment session ${input.session.id} marked as cancelled`,
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
  })
}

export function buildPaymentSessionExpiredActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentSessionExpiredLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  return buildPaymentSessionStatusActionLedgerInput(context, {
    session: input.session,
    actionName: "finance.payment_session.expire",
    actionKind: "update",
    routeOrToolName: "finance.payment_session.expire",
    commandInputRef: `payment_session:${input.session.id}:expire`,
    commandResultRef: `payment_session:${input.session.id}`,
    summary: `Payment session ${input.session.id} marked as expired`,
    authorizationSource: options.authorizationSource ?? "finance.payment_session.route",
  })
}

function buildPaymentSessionStatusActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: {
    session: PaymentSessionRecord
    actionName: string
    actionKind: BuildActionLedgerMutationInput["actionKind"]
    routeOrToolName: string
    authorizationSource: string | null
    commandInputRef: string
    commandResultRef: string | null
    summary: string
  },
): BuildActionLedgerMutationInput {
  const target = getPaymentSessionLedgerTarget(input.session)

  return {
    context,
    actionName: input.actionName,
    actionVersion: "v1",
    actionKind: input.actionKind,
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: input.routeOrToolName,
    authorizationSource: input.authorizationSource,
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: input.commandInputRef,
      commandResultRef: input.commandResultRef,
      summary: input.summary,
      reversalKind: "none",
    },
  }
}

export async function buildPaymentAuthorizationCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentAuthorizationCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getPaymentAuthorizationLedgerTarget(input.authorization)
  const idempotencyKey = input.authorization.externalAuthorizationId

  return {
    context,
    actionName: "finance.payment_authorization.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_authorization.create",
    authorizationSource: options.authorizationSource ?? "finance.payment_authorization.route",
    idempotencyScope: idempotencyKey
      ? `finance.${target.type}:${target.id}:payment_authorization`
      : null,
    idempotencyKey,
    idempotencyFingerprint: idempotencyKey
      ? await buildIdempotencyFingerprint({
          actionName: "finance.payment_authorization.create",
          actionVersion: "v1",
          targetType: target.type,
          targetId: target.id,
          commandInput: {
            paymentAuthorizationId: input.authorization.id,
            bookingId: input.authorization.bookingId,
            orderId: input.authorization.orderId,
            invoiceId: input.authorization.invoiceId,
            bookingGuaranteeId: input.authorization.bookingGuaranteeId,
            amountCents: input.authorization.amountCents,
            currency: input.authorization.currency,
            provider: input.authorization.provider,
            externalAuthorizationId: input.authorization.externalAuthorizationId,
            status: input.authorization.status,
          },
        })
      : null,
    mutationDetail: {
      commandInputRef: `${target.type}:${target.id}:payment_authorization`,
      commandResultRef: `payment_authorization:${input.authorization.id}`,
      summary: `Payment authorization ${input.authorization.id} created for ${target.type} ${target.id}`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentAuthorizationUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentAuthorizationUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentAuthorizationLedgerTarget(input.authorization)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.payment_authorization.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_authorization.update",
    authorizationSource: options.authorizationSource ?? "finance.payment_authorization.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_authorization:${input.authorization.id}:update`,
      commandResultRef: `payment_authorization:${input.authorization.id}`,
      summary: `Payment authorization ${input.authorization.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentAuthorizationDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentAuthorizationDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentAuthorizationLedgerTarget(input.authorization)

  return {
    context,
    actionName: "finance.payment_authorization.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_authorization.delete",
    authorizationSource: options.authorizationSource ?? "finance.payment_authorization.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_authorization:${input.authorization.id}:delete`,
      commandResultRef: null,
      summary: `Payment authorization ${input.authorization.id} deleted`,
      reversalKind: "none",
    },
  }
}

function getPaymentAuthorizationLedgerTarget(authorization: PaymentAuthorizationRecord) {
  if (authorization.bookingId) return { type: "booking", id: authorization.bookingId }
  if (authorization.invoiceId) return { type: "invoice", id: authorization.invoiceId }
  if (authorization.orderId) return { type: "order", id: authorization.orderId }
  if (authorization.bookingGuaranteeId) {
    return { type: "booking_guarantee", id: authorization.bookingGuaranteeId }
  }
  return { type: "payment_authorization", id: authorization.id }
}

export async function buildPaymentCaptureCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentCaptureCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getPaymentCaptureLedgerTarget(input.capture)
  const idempotencyKey = input.capture.externalCaptureId

  return {
    context,
    actionName: "finance.payment_capture.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_capture.create",
    authorizationSource: options.authorizationSource ?? "finance.payment_capture.route",
    idempotencyScope: idempotencyKey ? `finance.${target.type}:${target.id}:payment_capture` : null,
    idempotencyKey,
    idempotencyFingerprint: idempotencyKey
      ? await buildIdempotencyFingerprint({
          actionName: "finance.payment_capture.create",
          actionVersion: "v1",
          targetType: target.type,
          targetId: target.id,
          commandInput: {
            paymentCaptureId: input.capture.id,
            paymentAuthorizationId: input.capture.paymentAuthorizationId,
            invoiceId: input.capture.invoiceId,
            amountCents: input.capture.amountCents,
            currency: input.capture.currency,
            provider: input.capture.provider,
            externalCaptureId: input.capture.externalCaptureId,
            status: input.capture.status,
          },
        })
      : null,
    mutationDetail: {
      commandInputRef: `${target.type}:${target.id}:payment_capture`,
      commandResultRef: `payment_capture:${input.capture.id}`,
      summary: `Payment capture ${input.capture.id} created for ${target.type} ${target.id}`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentCaptureUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentCaptureUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentCaptureLedgerTarget(input.capture)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.payment_capture.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_capture.update",
    authorizationSource: options.authorizationSource ?? "finance.payment_capture.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_capture:${input.capture.id}:update`,
      commandResultRef: `payment_capture:${input.capture.id}`,
      summary: `Payment capture ${input.capture.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildPaymentCaptureDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: PaymentCaptureDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getPaymentCaptureLedgerTarget(input.capture)

  return {
    context,
    actionName: "finance.payment_capture.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.payment_capture.delete",
    authorizationSource: options.authorizationSource ?? "finance.payment_capture.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `payment_capture:${input.capture.id}:delete`,
      commandResultRef: null,
      summary: `Payment capture ${input.capture.id} deleted`,
      reversalKind: "none",
    },
  }
}

function getPaymentCaptureLedgerTarget(capture: PaymentCaptureRecord) {
  if (capture.invoiceId) return { type: "invoice", id: capture.invoiceId }
  if (capture.paymentAuthorizationId) {
    return { type: "payment_authorization", id: capture.paymentAuthorizationId }
  }
  return { type: "payment_capture", id: capture.id }
}

export function buildBookingPaymentScheduleCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingPaymentScheduleCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getBookingPaymentScheduleLedgerTarget(input.schedule)

  return {
    context,
    actionName: "finance.booking_payment_schedule.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_payment_schedule.create",
    authorizationSource: options.authorizationSource ?? "finance.booking_payment_schedule.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `booking:${input.schedule.bookingId}:payment_schedule`,
      commandResultRef: `booking_payment_schedule:${input.schedule.id}`,
      summary: `Payment schedule ${input.schedule.id} created for booking ${input.schedule.bookingId}`,
      reversalKind: "none",
    },
  }
}

export function buildBookingPaymentScheduleUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingPaymentScheduleUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getBookingPaymentScheduleLedgerTarget(input.schedule)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.booking_payment_schedule.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_payment_schedule.update",
    authorizationSource: options.authorizationSource ?? "finance.booking_payment_schedule.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `booking_payment_schedule:${input.schedule.id}:update`,
      commandResultRef: `booking_payment_schedule:${input.schedule.id}`,
      summary: `Payment schedule ${input.schedule.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildBookingPaymentScheduleDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingPaymentScheduleDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getBookingPaymentScheduleLedgerTarget(input.schedule)

  return {
    context,
    actionName: "finance.booking_payment_schedule.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_payment_schedule.delete",
    authorizationSource: options.authorizationSource ?? "finance.booking_payment_schedule.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `booking_payment_schedule:${input.schedule.id}:delete`,
      commandResultRef: null,
      summary: `Payment schedule ${input.schedule.id} deleted`,
      reversalKind: "none",
    },
  }
}

function getBookingPaymentScheduleLedgerTarget(schedule: BookingPaymentScheduleRecord) {
  return { type: "booking", id: schedule.bookingId }
}

export async function buildBookingGuaranteeCreateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingGuaranteeCreateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  const target = getBookingGuaranteeLedgerTarget(input.guarantee)
  const idempotencyKey = input.guarantee.referenceNumber

  return {
    context,
    actionName: "finance.booking_guarantee.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_guarantee.create",
    authorizationSource: options.authorizationSource ?? "finance.booking_guarantee.route",
    idempotencyScope: idempotencyKey
      ? `finance.booking:${input.guarantee.bookingId}:guarantee`
      : null,
    idempotencyKey,
    idempotencyFingerprint: idempotencyKey
      ? await buildIdempotencyFingerprint({
          actionName: "finance.booking_guarantee.create",
          actionVersion: "v1",
          targetType: target.type,
          targetId: target.id,
          commandInput: {
            bookingGuaranteeId: input.guarantee.id,
            bookingId: input.guarantee.bookingId,
            bookingPaymentScheduleId: input.guarantee.bookingPaymentScheduleId,
            guaranteeType: input.guarantee.guaranteeType,
            status: input.guarantee.status,
            paymentInstrumentId: input.guarantee.paymentInstrumentId,
            paymentAuthorizationId: input.guarantee.paymentAuthorizationId,
            currency: input.guarantee.currency,
            amountCents: input.guarantee.amountCents,
            provider: input.guarantee.provider,
            referenceNumber: input.guarantee.referenceNumber,
          },
        })
      : null,
    mutationDetail: {
      commandInputRef: `booking:${input.guarantee.bookingId}:guarantee`,
      commandResultRef: `booking_guarantee:${input.guarantee.id}`,
      summary: `Booking guarantee ${input.guarantee.id} created for booking ${input.guarantee.bookingId}`,
      reversalKind: "none",
    },
  }
}

export function buildBookingGuaranteeUpdateActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingGuaranteeUpdateLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getBookingGuaranteeLedgerTarget(input.guarantee)
  const changedFields = Object.keys(input.changes).sort()
  const changeSummary = changedFields.length > 0 ? changedFields.join(", ") : "no fields"

  return {
    context,
    actionName: "finance.booking_guarantee.update",
    actionVersion: "v1",
    actionKind: "update",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_guarantee.update",
    authorizationSource: options.authorizationSource ?? "finance.booking_guarantee.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `booking_guarantee:${input.guarantee.id}:update`,
      commandResultRef: `booking_guarantee:${input.guarantee.id}`,
      summary: `Booking guarantee ${input.guarantee.id} updated (${changeSummary})`,
      reversalKind: "none",
    },
  }
}

export function buildBookingGuaranteeDeleteActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingGuaranteeDeleteLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): BuildActionLedgerMutationInput {
  const target = getBookingGuaranteeLedgerTarget(input.guarantee)

  return {
    context,
    actionName: "finance.booking_guarantee.delete",
    actionVersion: "v1",
    actionKind: "delete",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: target.type,
    targetId: target.id,
    routeOrToolName: "finance.booking_guarantee.delete",
    authorizationSource: options.authorizationSource ?? "finance.booking_guarantee.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    mutationDetail: {
      commandInputRef: `booking_guarantee:${input.guarantee.id}:delete`,
      commandResultRef: null,
      summary: `Booking guarantee ${input.guarantee.id} deleted`,
      reversalKind: "none",
    },
  }
}

function getBookingGuaranteeLedgerTarget(guarantee: BookingGuaranteeRecord) {
  return { type: "booking", id: guarantee.bookingId }
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
