import type { AnyDrizzleDb } from "@voyant-travel/db"
import { definePort, type VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import { runPromotionBoundaryScheduler } from "./service-boundary-scheduler.js"
import type { BulkReindexProductsService } from "./workflow-runtime.js"

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

export async function runPromotionBoundaryJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(promotionBoundaryJobRuntimePort)
  const result = await runtime.withDb((db) => runPromotionBoundaryScheduler({ db }))
  if (result.crossings.length === 0) return

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
}
