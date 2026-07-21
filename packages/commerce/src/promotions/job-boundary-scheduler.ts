import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { promotionBoundaryJobRuntimePort } from "./boundary-job-runtime-port.js"
import { runPromotionBoundaryScheduler } from "./service-boundary-scheduler.js"

export {
  type PromotionBoundaryJobRuntime,
  promotionBoundaryJobRuntimePort,
} from "./boundary-job-runtime-port.js"

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
