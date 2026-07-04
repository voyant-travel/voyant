/**
 * Bulk-reindex workflow + event filter for `affected.kind === "all"`.
 *
 * The `promotion.changed` payload's `affected` is a discriminated union:
 *   - `{ kind: "products", productIds }` — small, bounded set; the catalog
 *     bridge reindexes inline on the in-process EventBus subscriber.
 *   - `{ kind: "all" }` — every owned product (global / market / audience-
 *     scoped offers). Inline enumeration would burn the request handler's
 *     request budget on a sizeable catalog, so this branch routes through a
 *     workflow that breaks the work into one step per product. The
 *     orchestrator schedules them in parallel so each individual step stays
 *     bounded.
 *
 * The workflow body delegates catalog access to a service the operator
 * template registers under `BULK_REINDEX_SERVICE_KEY`. The promotions
 * package stays catalog-agnostic: it knows nothing about Typesense / index
 * slices / document builders. The seam is the same one used elsewhere in
 * the codebase for cross-module behavior (workflow → ctx.services.resolve).
 */

import { workflow } from "@voyant-travel/workflows"

import {
  type BulkReindexProductsInput,
  type BulkReindexProductsOutput,
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
} from "./workflow-bulk-reindex-manifest.js"
import { BULK_REINDEX_SERVICE_KEY, type BulkReindexProductsService } from "./workflow-runtime.js"

/** Cap on concurrent per-product reindex steps to avoid hammering the index. */
const REINDEX_CONCURRENCY = 8

export const bulkReindexProductsWorkflow = workflow<
  BulkReindexProductsInput,
  BulkReindexProductsOutput
>({
  ...bulkReindexProductsWorkflowManifest.config,
  id: bulkReindexProductsWorkflowManifest.id,
  async run(_input, ctx) {
    const svc = ctx.services.resolve<BulkReindexProductsService>(BULK_REINDEX_SERVICE_KEY)

    const ids = await ctx.step("list-product-ids", async () => svc.listAllProductIds())
    if (ids.length === 0) return { reindexed: 0 }

    await ctx.parallel(
      ids,
      async (productId) =>
        ctx.step(`reindex:${productId}`, async () => {
          await svc.reindexProduct(productId)
        }),
      { concurrency: REINDEX_CONCURRENCY },
    )

    return { reindexed: ids.length }
  },
})

export {
  type BulkReindexProductsInput,
  type BulkReindexProductsOutput,
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
}
