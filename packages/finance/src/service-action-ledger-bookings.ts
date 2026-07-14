import {
  type ActionLedgerRequestContextValues,
  type BuildActionLedgerMutationInput,
  buildIdempotencyFingerprint,
} from "@voyant-travel/action-ledger"
import type { Booking } from "@voyant-travel/bookings/schema"

type BookingCreateLedgerCommand = {
  productId: string
  optionId?: string | null
  slotId?: string | null
  bookingNumber: string
  personId?: string | null
  organizationId?: string | null
  pax?: number | null
  itemLineCount?: number
  extraLineCount?: number
  travelerCount?: number
  paymentScheduleCount?: number
  travelCreditRedemptionRequested?: boolean
  groupMembershipAction?: "join" | "create" | null
  initialStatus?: string | null
  documentGeneration?: {
    contractDocument: boolean
    invoiceDocument: boolean
    invoiceType: "invoice" | "proforma"
  }
}

type BookingCreateSucceededLedgerInput = {
  booking: Booking
  command: BookingCreateLedgerCommand
}

type BookingCreateRejectedLedgerInput = {
  existingBooking: {
    id: string
    bookingNumber: string
    status: string
  }
  command: BookingCreateLedgerCommand
  reason: "duplicate_booking"
}

export async function buildBookingCreateSucceededActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingCreateSucceededLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  return {
    context,
    actionName: "booking.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "succeeded",
    evaluatedRisk: "high",
    targetType: "booking",
    targetId: input.booking.id,
    routeOrToolName: "booking.create",
    authorizationSource: options.authorizationSource ?? "booking.create.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "booking.create",
      actionVersion: "v1",
      targetType: "booking",
      targetId: input.booking.id,
      commandInput: sanitizeBookingCreateCommand(input.command),
    }),
    mutationDetail: {
      commandInputRef: `booking_create:${input.booking.bookingNumber}:input`,
      commandResultRef: `booking:${input.booking.id}`,
      summary: `Booking ${input.booking.bookingNumber} created`,
      reversalKind: "none",
    },
  }
}

export async function buildBookingCreateRejectedActionLedgerInput(
  context: ActionLedgerRequestContextValues,
  input: BookingCreateRejectedLedgerInput,
  options: {
    authorizationSource?: string | null
  } = {},
): Promise<BuildActionLedgerMutationInput> {
  return {
    context,
    actionName: "booking.create",
    actionVersion: "v1",
    actionKind: "create",
    status: "failed",
    evaluatedRisk: "high",
    targetType: "booking",
    targetId: input.existingBooking.id,
    routeOrToolName: "booking.create",
    authorizationSource: options.authorizationSource ?? "booking.create.route",
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: await buildIdempotencyFingerprint({
      actionName: "booking.create",
      actionVersion: "v1",
      targetType: "booking",
      targetId: input.existingBooking.id,
      commandInput: {
        ...sanitizeBookingCreateCommand(input.command),
        rejectionReason: input.reason,
      },
    }),
    mutationDetail: {
      commandInputRef: `booking_create:${input.command.bookingNumber}:input`,
      commandResultRef: `booking:${input.existingBooking.id}`,
      summary: `Booking create rejected as duplicate of ${input.existingBooking.bookingNumber}`,
      reversalKind: "none",
    },
  }
}

function sanitizeBookingCreateCommand(command: BookingCreateLedgerCommand) {
  return {
    productId: command.productId,
    optionId: command.optionId ?? null,
    slotId: command.slotId ?? null,
    bookingNumber: command.bookingNumber,
    personId: command.personId ?? null,
    organizationId: command.organizationId ?? null,
    pax: command.pax ?? null,
    itemLineCount: command.itemLineCount ?? 0,
    extraLineCount: command.extraLineCount ?? 0,
    travelerCount: command.travelerCount ?? 0,
    paymentScheduleCount: command.paymentScheduleCount ?? 0,
    travelCreditRedemptionRequested: command.travelCreditRedemptionRequested === true,
    groupMembershipAction: command.groupMembershipAction ?? null,
    initialStatus: command.initialStatus ?? null,
    documentGeneration: command.documentGeneration ?? null,
  }
}
