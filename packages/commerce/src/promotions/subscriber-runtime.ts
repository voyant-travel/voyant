import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import { recordPromotionRedemptionsForBooking } from "./service-booking-confirmed.js"

export const COMMERCE_PROMOTION_REDEMPTION_SUBSCRIBER_ID =
  "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed"

export interface PromotionRedemptionSubscriberRuntimeOptions<TBindings = unknown> {
  /** Resolve the deployment database and retain ownership of its lifecycle. */
  withDb<T>(bindings: TBindings, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  recordRedemptions?: typeof recordPromotionRedemptionsForBooking
  logger?: Pick<Console, "warn">
}

interface BookingConfirmedPayload {
  bookingId: string
}

/** Build the executable descriptor without activating it in the package manifest. */
export function createPromotionRedemptionSubscriberRuntime<TBindings = unknown>(
  options: PromotionRedemptionSubscriberRuntimeOptions<TBindings>,
): SubscriberRuntimeDescriptor {
  const recordRedemptions = options.recordRedemptions ?? recordPromotionRedemptionsForBooking
  const logger = options.logger ?? console

  return {
    id: COMMERCE_PROMOTION_REDEMPTION_SUBSCRIBER_ID,
    eventType: "booking.confirmed",
    register: ({ bindings, eventBus }) => {
      const runtimeBindings = bindings as TBindings
      eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
        await options.withDb(runtimeBindings, async (db) => {
          try {
            await recordRedemptions(db, data.bookingId)
          } catch (error) {
            logger.warn("[catalog-bridge] promotion redemption recorder failed", {
              bookingId: data.bookingId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        })
      })
    },
  }
}
