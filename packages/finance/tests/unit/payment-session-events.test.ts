import { describe, expect, it } from "vitest"

import {
  buildBookingPaymentSchedulePaidEvent,
  buildPaymentCompletedEvent,
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
})
