import { describe, expect, it } from "vitest"

import {
  buildBookingPaymentSchedulePaidEvent,
  buildPaymentCompletedEvent,
  buildPaymentSessionCompletionActionLedgerInput,
} from "../../src/service.js"

describe("payment session events", () => {
  it("builds schedule-paid events with booking lifecycle context", () => {
    const session = {
      id: "psess_123",
      provider: "netopia",
      targetType: "booking_payment_schedule",
      targetId: "bps_123",
      bookingId: "book_123",
      orderId: null,
      invoiceId: null,
      bookingPaymentScheduleId: "bps_123",
      bookingGuaranteeId: null,
      amountCents: 25000,
      currency: "USD",
    }
    const schedule = {
      id: "bps_123",
      bookingId: "book_123",
      scheduleType: "deposit",
      amountCents: 25000,
      currency: "USD",
    }

    expect(
      buildBookingPaymentSchedulePaidEvent(schedule as never, session as never, "pay_123"),
    ).toEqual({
      bookingId: "book_123",
      bookingPaymentScheduleId: "bps_123",
      paymentSessionId: "psess_123",
      paymentId: "pay_123",
      scheduleType: "deposit",
      amountCents: 25000,
      currency: "USD",
      provider: "netopia",
    })
  })

  it("includes target metadata on generic payment completion events", () => {
    expect(
      buildPaymentCompletedEvent({
        id: "psess_123",
        targetType: "booking_payment_schedule",
        targetId: "bps_123",
        bookingId: "book_123",
        orderId: null,
        invoiceId: null,
        bookingPaymentScheduleId: "bps_123",
        bookingGuaranteeId: null,
        amountCents: 25000,
        currency: "USD",
        provider: "netopia",
      } as never),
    ).toMatchObject({
      paymentSessionId: "psess_123",
      targetType: "booking_payment_schedule",
      targetId: "bps_123",
      bookingId: "book_123",
      bookingPaymentScheduleId: "bps_123",
      bookingGuaranteeId: null,
      amountCents: 25000,
      currency: "USD",
      provider: "netopia",
    })
  })

  it("builds booking-targeted action ledger input for payment completions", async () => {
    const ledgerInput = await buildPaymentSessionCompletionActionLedgerInput(
      {
        userId: "user_123",
        callerType: "session",
      },
      {
        session: {
          id: "psess_123",
          bookingId: "book_123",
          invoiceId: "inv_123",
          orderId: null,
          providerPaymentId: "provider_payment_123",
          externalReference: null,
          idempotencyKey: null,
        } as never,
        status: "paid",
        paymentId: "pay_123",
      },
    )

    expect(ledgerInput).toMatchObject({
      actionName: "finance.payment_session.complete",
      actionKind: "execute",
      status: "succeeded",
      evaluatedRisk: "high",
      targetType: "booking",
      targetId: "book_123",
      routeOrToolName: "finance.payment_session.complete",
      authorizationSource: "finance.payment_session.route",
      idempotencyScope: "finance.payment_session:psess_123:complete",
      idempotencyKey: "provider_payment_123",
      mutationDetail: {
        commandInputRef: "payment_session:psess_123:complete",
        commandResultRef: "payment:pay_123",
        summary: "Payment session psess_123 completed as paid",
        reversalKind: "none",
      },
    })
    expect(ledgerInput.idempotencyFingerprint).toMatch(/^sha256:/)
  })
})
