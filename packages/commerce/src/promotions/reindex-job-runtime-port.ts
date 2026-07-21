import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import type { BulkReindexProductsService } from "./job-runtime.js"

export interface PromotionReindexJobRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  createService(): BulkReindexProductsService | Promise<BulkReindexProductsService>
}

export const promotionReindexJobRuntimePort = definePort<PromotionReindexJobRuntime>({
  id: "commerce.promotion-reindex-job",
  test(runtime) {
    if (
      !runtime ||
      typeof runtime.withDb !== "function" ||
      typeof runtime.createService !== "function"
    ) {
      throw new Error(
        "commerce.promotion-reindex-job provider must implement withDb() and createService().",
      )
    }
  },
})
