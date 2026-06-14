import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyant-travel/action-ledger"
import type { z } from "zod"

import type { paymentAuthorizations, paymentCaptures } from "./schema.js"
import type { updatePaymentAuthorizationSchema, updatePaymentCaptureSchema } from "./validation.js"

type UpdatePaymentAuthorizationInput = z.infer<typeof updatePaymentAuthorizationSchema>
type UpdatePaymentCaptureInput = z.infer<typeof updatePaymentCaptureSchema>

type PaymentAuthorizationRecord = typeof paymentAuthorizations.$inferSelect
type PaymentCaptureRecord = typeof paymentCaptures.$inferSelect

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
            legacyOrderId: input.authorization.orderId,
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
