import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyant-travel/action-ledger"
import type { z } from "zod"

import type { paymentInstruments, paymentSessions } from "./schema.js"
import type {
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  markPaymentSessionRequiresRedirectSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSessionSchema,
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

type PaymentSessionRecord = typeof paymentSessions.$inferSelect
type PaymentInstrumentRecord = typeof paymentInstruments.$inferSelect

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
