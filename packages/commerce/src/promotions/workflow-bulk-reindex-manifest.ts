import type { WorkflowDescriptor } from "@voyant-travel/core"
import { trigger } from "@voyant-travel/workflows"

import { PROMOTION_CHANGED_EVENT, type PromotionChangedSource } from "./events.js"

export interface BulkReindexProductsInput {
  /** The offer that triggered the reindex (for logging / correlation). */
  offerId: string
  source: PromotionChangedSource
}

export interface BulkReindexProductsOutput {
  reindexed: number
}

export const bulkReindexProductsWorkflowManifest = {
  id: "promotions.reindex-all-products",
  config: {
    defaultRuntime: "node" as const,
  },
} satisfies WorkflowDescriptor

/**
 * Routes `promotion.changed` envelopes whose `affected.kind === "all"` into
 * the workflow above. Other shapes (`{ kind: "products", productIds }`) fall
 * through to the in-process catalog-bridge subscriber.
 */
export const promotionAffectedAllFilter = trigger.on<BulkReindexProductsInput>(
  PROMOTION_CHANGED_EVENT,
  {
    target: { id: bulkReindexProductsWorkflowManifest.id },
    where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
    input: {
      object: {
        offerId: { path: "data.offerId" },
        source: { path: "data.source" },
      },
    },
  },
)
