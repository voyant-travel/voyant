import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { BulkReindexProductsService } from "./job-runtime.js"

export interface PromotionBoundaryJobRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  createReindexService(): BulkReindexProductsService | Promise<BulkReindexProductsService>
}

export const promotionBoundaryJobRuntimePort = definePort<PromotionBoundaryJobRuntime>({
  id: "commerce.promotion-boundary-job",
  test(runtime) {
    if (
      !runtime ||
      typeof runtime.withDb !== "function" ||
      typeof runtime.createReindexService !== "function"
    ) {
      throw new Error("commerce.promotion-boundary-job provider is incomplete.")
    }
  },
})
