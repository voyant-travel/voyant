import type { BootstrapContext, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./runtime-ports.js"
import { recordPromotionRedemptionsForBooking } from "./service-booking-confirmed.js"
import { BULK_REINDEX_SERVICE_KEY } from "./job-runtime.js"

export const COMMERCE_PROMOTION_REDEMPTION_SUBSCRIBER_ID =
  "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed"

export interface PromotionRedemptionSubscriberRuntimeOptions<TBindings = unknown> {
  /** Resolve the deployment database and retain ownership of its lifecycle. */
  withDb<T>(bindings: TBindings, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  recordRedemptions?: typeof recordPromotionRedemptionsForBooking
  logger?: Pick<Console, "warn">
}

export type {
  PromotionRedemptionDatabaseRuntime,
  PromotionsBulkReindexRuntime,
} from "./runtime-ports.js"
export {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./runtime-ports.js"

interface BookingConfirmedPayload {
  bookingId: string
}

/** Build the package-owned descriptor resolved by selected-graph lowering. */
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

/** Selected-graph factory for redemption recording and promotion workflow services. */
export const createPromotionRedemptionSubscriberGraphRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const [database, bulkReindex] = await Promise.all([
      getPort(promotionRedemptionDatabaseRuntimePort),
      getPort(promotionsBulkReindexRuntimePort),
    ])
    const descriptor = createPromotionRedemptionSubscriberRuntime(database)

    return {
      ...descriptor,
      register: async (context: BootstrapContext) => {
        const reindexService = await bulkReindex.createService(context.bindings)
        context.container.register(BULK_REINDEX_SERVICE_KEY, reindexService)
        await descriptor.register(context)
      },
    }
  },
)
