/**
 * Promotions boundary scheduler — Cloudflare Workers cron entrypoint.
 *
 * Wakes every 5 minutes and asks `runPromotionBoundaryScheduler` to scan
 * for offers whose `valid_from` / `valid_until` crossed the watermark
 * since the last tick. For each crossing we directly reindex the
 * affected products through the same code path the catalog-bridge uses
 * for live `promotion.changed` events.
 *
 * Why we dispatch inline instead of emitting events: Cloudflare Workers
 * scheduled handlers run in their own isolate-call and don't share an
 * in-process `EventBus` with the running app — the catalog-bridge's
 * `promotion.changed` subscriber lives on a different bus instance and
 * would never see events emitted from here. Calling the indexer
 * directly is the simplest path that actually works.
 *
 * Without this, an indexed product document would continue to show an
 * expired discount until something else triggered a reindex.
 *
 * Per docs/architecture/promotions-architecture.md §9.2.
 */

import { createIndexerService } from "@voyantjs/catalog"
import {
  type BoundarySchedulerResult,
  runPromotionBoundaryScheduler,
} from "@voyantjs/promotions/service-boundary-scheduler"

import {
  buildEmbeddingProvider,
  buildTypesenseIndexer,
  createProductsDocumentBuilder,
  DEFAULT_SLICES,
  getFieldPolicyRegistries,
  withEmbedding,
} from "./lib/catalog-runtime"
import { withDbFromEnv } from "./lib/db"

/** Cron expression — declared in `wrangler.jsonc` and matched against `event.cron` in `entry.ts`. */
export const PROMOTION_BOUNDARY_SCHEDULER_CRON = "*/5 * * * *"

export async function runScheduledPromotionBoundary(
  _event: ScheduledController,
  env: CloudflareBindings,
): Promise<BoundarySchedulerResult & { reindexedProductIds: number }> {
  // `withDbFromEnv` owns the per-tick Pool — the WebSocket closes when
  // this scheduled run finishes, instead of leaking until isolate
  // teardown. Mirrors the lifecycle pattern from #510 / #512.
  return withDbFromEnv(env, async (db) => {
    const result = await runPromotionBoundaryScheduler({ db })

    // Build the indexer once per tick (Pool already open via withDbFromEnv).
    const sellerOperatorId = (env as unknown as { TENANT_ID?: string }).TENANT_ID ?? "default"
    const embeddings = buildEmbeddingProvider(env)
    const indexer = buildTypesenseIndexer(env, embeddings)
    let reindexedProductIds = 0

    if (indexer && result.crossings.length > 0) {
      const service = createIndexerService({
        adapter: indexer,
        slices: [...DEFAULT_SLICES],
        registries: getFieldPolicyRegistries(),
      })
      const builder = withEmbedding(
        createProductsDocumentBuilder(db, { sellerOperatorId }),
        embeddings,
      )

      // Aggregate distinct product IDs across all crossings so multiple
      // offers crossing on the same product reindex once. When a
      // crossing is `affected.kind === "all"` (global / market /
      // audience scope change), log + skip — inline enumeration of
      // every owned product is unsafe in a Workers cron handler (CPU /
      // wall-time limits, especially for large catalogs). Operators
      // run `pnpm exec tsx scripts/reindex.ts products` to refresh
      // after such crossings.
      //
      // Tracked: voyantjs/voyant#515 — moves this branch onto a
      // `@voyantjs/workflows` workflow with `defaultRuntime: "node"`,
      // triggered via `trigger.on("promotion.changed", ...)`. Blocked
      // on voyantjs/voyant#514 (`trigger.on()` runtime).
      const productIds = new Set<string>()
      for (const crossing of result.crossings) {
        if (crossing.affected.kind === "products") {
          for (const id of crossing.affected.productIds) productIds.add(id)
        } else {
          console.warn(
            "[promotion-scheduled] crossing affected=all — bulk reindex skipped (unsafe inline on Workers); run `pnpm exec tsx scripts/reindex.ts products` to refresh. See voyantjs/voyant#515.",
            { offerId: crossing.offerId, source: crossing.source },
          )
        }
      }

      for (const productId of productIds) {
        await service.reindexEntity("products", productId, builder)
        reindexedProductIds++
      }
    }

    return { ...result, reindexedProductIds }
  })
}
