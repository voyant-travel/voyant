import { createContainer, createEventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { PaymentCompletedEvent } from "@voyant-travel/finance"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { completeTripCheckout } = vi.hoisted(() => ({
  completeTripCheckout: vi.fn(),
}))

vi.mock("../src/service-checkout.js", () => ({ completeTripCheckout }))

import {
  TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY,
  tripsPaymentCompletedSubscriber,
} from "../src/payment-subscriber-runtime.js"

const paymentCompleted = (
  overrides: Partial<PaymentCompletedEvent> = {},
): PaymentCompletedEvent => ({
  paymentSessionId: "payment_sessions_123",
  targetType: "other",
  targetId: "trip_123",
  bookingId: null,
  legacyOrderId: null,
  invoiceId: null,
  bookingPaymentScheduleId: null,
  bookingGuaranteeId: null,
  amountCents: 12_500,
  currency: "EUR",
  provider: "netopia",
  ...overrides,
})

describe("trips payment subscriber runtime", () => {
  beforeEach(() => {
    completeTripCheckout.mockReset()
  })

  it("matches the staged graph subscriber declaration", () => {
    expect(tripsPaymentCompletedSubscriber).toMatchObject({
      id: "@voyant-travel/trips#subscriber.payment-completed",
      eventType: "payment.completed",
      register: expect.any(Function),
    })
  })

  it("completes trip checkouts for other targets with trip ids", async () => {
    const db = { kind: "test-db" } as unknown as AnyDrizzleDb
    const container = createContainer()
    const eventBus = createEventBus()
    const withDb = vi.fn(async (operation: (input: AnyDrizzleDb) => Promise<unknown>) =>
      operation(db),
    )
    container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, { withDb })

    await tripsPaymentCompletedSubscriber.register({ container, eventBus })
    await eventBus.emit("payment.completed", paymentCompleted())

    expect(withDb).toHaveBeenCalledOnce()
    expect(completeTripCheckout).toHaveBeenCalledWith(db, {
      envelopeId: "trip_123",
      paymentSessionId: "payment_sessions_123",
      payload: {
        amountCents: 12_500,
        currency: "EUR",
        provider: "netopia",
        targetType: "other",
        targetId: "trip_123",
      },
    })
  })

  it.each([
    paymentCompleted({ targetType: "booking" }),
    paymentCompleted({ targetId: "order_123" }),
    paymentCompleted({ targetId: null }),
  ])("ignores payment completion outside the trips target contract", async (event) => {
    const container = createContainer()
    const eventBus = createEventBus()
    const withDb = vi.fn()
    container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, { withDb })

    await tripsPaymentCompletedSubscriber.register({ container, eventBus })
    await eventBus.emit("payment.completed", event)

    expect(withDb).not.toHaveBeenCalled()
    expect(completeTripCheckout).not.toHaveBeenCalled()
  })
})
