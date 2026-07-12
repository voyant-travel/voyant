import type { AnyDrizzleDb } from "@voyant-travel/db"
import { workflow } from "@voyant-travel/workflows"

import { runPromotionBoundaryScheduler } from "./service-boundary-scheduler.js"
import type { BulkReindexProductsService } from "./workflow-runtime.js"

export const PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY =
  "commerce.workflows.promotion-boundary-scheduler.runtime" as const

export interface PromotionBoundarySchedulerRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  createReindexService(): BulkReindexProductsService | Promise<BulkReindexProductsService>
}

export const promotionBoundarySchedulerWorkflow = workflow({
  id: "commerce.process-promotion-boundaries",
  defaultRuntime: "node",
  schedule: { cron: "*/5 * * * *", name: "every-5-minutes" },
  async run(_input, context) {
    const runtime = context.services.resolve<PromotionBoundarySchedulerRuntime>(
      PROMOTION_BOUNDARY_SCHEDULER_RUNTIME_KEY,
    )
    const result = await runtime.withDb((db) => runPromotionBoundaryScheduler({ db }))
    if (result.crossings.length === 0) return { ...result, reindexedProductIds: 0 }

    const reindex = await runtime.createReindexService()
    const productIds = new Set<string>()
    let affectsAll = false
    for (const crossing of result.crossings) {
      if (crossing.affected.kind === "all") affectsAll = true
      else for (const productId of crossing.affected.productIds) productIds.add(productId)
    }
    if (affectsAll) {
      for (const productId of await reindex.listAllProductIds()) productIds.add(productId)
    }
    for (const productId of productIds) await reindex.reindexProduct(productId)
    return { ...result, reindexedProductIds: productIds.size }
  },
})
