import { describe, expect, it } from "vitest"

import * as ledger from "../../src/service-action-ledger.js"

describe("finance booking payment action ledger builders", () => {
  it("builds booking-targeted action ledger input for payment schedule creation", () => {
    const ledgerInput = ledger.buildBookingPaymentScheduleCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        schedule: {
          id: "bps_123",
          bookingId: "book_123",
          scheduleType: "deposit",
          status: "pending",
          dueDate: "2026-06-01",
          amountCents: 25000,
          currency: "USD",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_payment_schedule.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_payment_schedule.create",
      authorizationSource: "finance.booking_payment_schedule.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "booking:book_123:payment_schedule",
        commandResultRef: "booking_payment_schedule:bps_123",
        summary: "Payment schedule bps_123 created for booking book_123",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for payment schedule updates", () => {
    const ledgerInput = ledger.buildBookingPaymentScheduleUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        schedule: {
          id: "bps_123",
          bookingId: "book_123",
        } as never,
        changes: {
          dueDate: "2026-06-15",
          status: "due",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_payment_schedule.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_payment_schedule.update",
      authorizationSource: "finance.booking_payment_schedule.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "booking_payment_schedule:bps_123:update",
        commandResultRef: "booking_payment_schedule:bps_123",
        summary: "Payment schedule bps_123 updated (dueDate, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for payment schedule deletes", () => {
    const ledgerInput = ledger.buildBookingPaymentScheduleDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        schedule: {
          id: "bps_123",
          bookingId: "book_123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_payment_schedule.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_payment_schedule.delete",
      authorizationSource: "finance.booking_payment_schedule.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "booking_payment_schedule:bps_123:delete",
        commandResultRef: null,
        summary: "Payment schedule bps_123 deleted",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for booking guarantee creation", async () => {
    const ledgerInput = await ledger.buildBookingGuaranteeCreateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        guarantee: {
          id: "bg_123",
          bookingId: "book_123",
          bookingPaymentScheduleId: "bps_123",
          guaranteeType: "authorization_hold",
          status: "pending",
          paymentInstrumentId: "pins_123",
          paymentAuthorizationId: null,
          amountCents: 25000,
          currency: "USD",
          provider: "netopia",
          referenceNumber: "guarantee-ref-123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_guarantee.create",
      actionKind: "create",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_guarantee.create",
      authorizationSource: "finance.booking_guarantee.route",
      idempotencyScope: "finance.booking:book_123:guarantee",
      idempotencyKey: "guarantee-ref-123",
      mutationDetail: {
        commandInputRef: "booking:book_123:guarantee",
        commandResultRef: "booking_guarantee:bg_123",
        summary: "Booking guarantee bg_123 created for booking book_123",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })

  it("builds booking-targeted action ledger input for booking guarantee updates", () => {
    const ledgerInput = ledger.buildBookingGuaranteeUpdateActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        guarantee: {
          id: "bg_123",
          bookingId: "book_123",
        } as never,
        changes: {
          releasedAt: "2026-06-20T12:00:00.000Z",
          status: "released",
        },
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_guarantee.update",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_guarantee.update",
      authorizationSource: "finance.booking_guarantee.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "booking_guarantee:bg_123:update",
        commandResultRef: "booking_guarantee:bg_123",
        summary: "Booking guarantee bg_123 updated (releasedAt, status)",
        reversalKind: "none",
      },
    })
  })

  it("builds booking-targeted action ledger input for booking guarantee deletes", () => {
    const ledgerInput = ledger.buildBookingGuaranteeDeleteActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        guarantee: {
          id: "bg_123",
          bookingId: "book_123",
        } as never,
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.booking_guarantee.delete",
      actionKind: "delete",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.booking_guarantee.delete",
      authorizationSource: "finance.booking_guarantee.route",
      idempotencyScope: null,
      idempotencyKey: null,
      idempotencyFingerprint: null,
      mutationDetail: {
        commandInputRef: "booking_guarantee:bg_123:delete",
        commandResultRef: null,
        summary: "Booking guarantee bg_123 deleted",
        reversalKind: "none",
      },
    })
  })
})
