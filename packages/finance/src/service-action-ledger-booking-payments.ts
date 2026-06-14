import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyant-travel/action-ledger"
import type { z } from "zod"

import type { bookingGuarantees, bookingPaymentSchedules } from "./schema.js"
import type {
  updateBookingGuaranteeSchema,
  updateBookingPaymentScheduleSchema,
} from "./validation.js"

type UpdateBookingPaymentScheduleInput = z.infer<typeof updateBookingPaymentScheduleSchema>
type UpdateBookingGuaranteeInput = z.infer<typeof updateBookingGuaranteeSchema>

type BookingPaymentScheduleRecord = typeof bookingPaymentSchedules.$inferSelect
type BookingGuaranteeRecord = typeof bookingGuarantees.$inferSelect

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
