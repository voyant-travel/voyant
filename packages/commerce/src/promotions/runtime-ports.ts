import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import type { BulkReindexProductsService } from "./workflow-runtime.js"

export interface PromotionRedemptionDatabaseRuntime {
  withDb<T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
}

export interface PromotionsBulkReindexRuntime {
  createService(bindings: unknown): BulkReindexProductsService | Promise<BulkReindexProductsService>
}

export const promotionRedemptionDatabaseRuntimePort =
  definePort<PromotionRedemptionDatabaseRuntime>({
    id: "commerce.promotion-redemption-database",
    test(provider) {
      if (
        provider === null ||
        typeof provider !== "object" ||
        typeof provider.withDb !== "function"
      ) {
        throw new Error("commerce.promotion-redemption-database provider must implement withDb().")
      }
    },
  })

export const promotionsBulkReindexRuntimePort = definePort<PromotionsBulkReindexRuntime>({
  id: "commerce.promotions-bulk-reindex",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.createService !== "function"
    ) {
      throw new Error("commerce.promotions-bulk-reindex provider must implement createService().")
    }
  },
})
