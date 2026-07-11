import type { BootstrapContext } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { PaymentCompletedEvent } from "@voyant-travel/finance"

import { completeTripCheckout } from "./service-checkout.js"

const TRIPS_PAYMENT_COMPLETED_SUBSCRIBER_ID = "@voyant-travel/trips#subscriber.payment-completed"

export const TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY = "trips.payment-subscriber.runtime" as const

export interface TripsPaymentSubscriberRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
}

/** Executable descriptor staged for the graph cutover after central bundle removal. */
export const tripsPaymentCompletedSubscriber = {
  id: TRIPS_PAYMENT_COMPLETED_SUBSCRIBER_ID,
  eventType: "payment.completed",
  register: ({ container, eventBus }: BootstrapContext) => {
    eventBus.subscribe<PaymentCompletedEvent>("payment.completed", async ({ data }) => {
      if (data.targetType !== "other" || !data.targetId?.startsWith("trip_")) return

      try {
        const runtime = container.resolve<TripsPaymentSubscriberRuntime>(
          TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY,
        )
        await runtime.withDb((db) =>
          completeTripCheckout(db, {
            envelopeId: data.targetId ?? undefined,
            paymentSessionId: data.paymentSessionId,
            payload: {
              amountCents: data.amountCents,
              currency: data.currency,
              provider: data.provider,
              targetType: data.targetType,
              targetId: data.targetId,
            },
          }),
        )
      } catch (error) {
        console.error("[trips] payment completion failed", error)
      }
    })
  },
}
