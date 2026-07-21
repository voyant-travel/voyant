import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { sql } from "drizzle-orm"

import { promotionRedemptionDatabaseRuntimePort } from "./runtime-ports.js"
import { promotionReindexState } from "./schema.js"

export const PROMOTION_REINDEX_INTENT_SUBSCRIBER_ID =
  "@voyant-travel/commerce#subscriber.promotion-reindex-intent"

export const createPromotionReindexIntentSubscriberGraphRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const database = await getPort(promotionRedemptionDatabaseRuntimePort)
    return {
      id: PROMOTION_REINDEX_INTENT_SUBSCRIBER_ID,
      eventType: "promotion.changed",
      register: ({ bindings, eventBus }) => {
        eventBus.subscribe<{ affected?: { kind?: string } }>(
          "promotion.changed",
          async ({ data }) => {
            if (data.affected?.kind !== "all") return
            await database.withDb(bindings, async (db) => {
              await db
                .insert(promotionReindexState)
                .values({ id: "all-products", requestedGeneration: 1 })
                .onConflictDoUpdate({
                  target: promotionReindexState.id,
                  set: {
                    requestedGeneration: sql`${promotionReindexState.requestedGeneration} + 1`,
                    requestedAt: new Date(),
                    updatedAt: new Date(),
                  },
                })
            })
          },
        )
      },
    } satisfies SubscriberRuntimeDescriptor
  },
)
