/**
 * Source discovery sync — pulls projections from every registered
 * `SourceAdapter` and pushes them into the deployment's indexer so
 * sourced inventory shows up in the catalog UI alongside owned rows.
 *
 * Mirrors the bulk reindex flow (`scripts/reindex.ts` in operator
 * templates) for owned rows, except the data comes from
 * `adapter.discover()` instead of a Drizzle table scan.
 *
 * The orchestrator is pure: it takes the registry, the indexer service,
 * and the per-vertical field-policy registries, and returns a summary
 * of what was synced. Templates wire env / Typesense / embeddings; this
 * function only touches what was passed in.
 *
 * Usage pattern (in a template script):
 *
 *   const summary = await syncSources({
 *     registry,
 *     indexerService,
 *     fieldPolicyRegistries,
 *   })
 *
 * Drift events, scheduled re-runs, and concurrency limits are deferred
 * to the catalog plane's normal drift pipeline (foundation §5.5);
 * `syncSources` is a one-shot bulk pass driven by a CLI or cron job.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"

import type { SourceAdapter, SourceAdapterContext } from "../adapter/contract.js"
import type { FieldPolicyRegistry } from "../contract.js"
import type { IndexerDocument, IndexerSlice } from "../indexer/contract.js"
import { isOwned } from "../provenance.js"
import type { DocumentBuilder, IndexerService } from "../services/indexer-service.js"
import { buildIndexerDocument } from "../services/indexer-service.js"
import { upsertSourcedEntry } from "../services/sourced-entry-service.js"

import type { SourceAdapterRegistry } from "./registry.js"

export interface SyncSourcesOptions {
  /** Booking-engine registry — every registered adapter's `discover` is fanned out. */
  registry: SourceAdapterRegistry
  /** Indexer the projections land in. Caller passes the same instance the live route uses. */
  indexerService: IndexerService
  /**
   * Per-vertical field-policy registries keyed by `entity_module`.
   * Same shape the indexer service is built with; passed separately so
   * the sync can build documents from projections without re-reading
   * the registry from the indexer service.
   */
  fieldPolicyRegistries: ReadonlyMap<string, FieldPolicyRegistry>
  /**
   * Drizzle DB handle. When set, sync upserts a row into
   * `catalog_sourced_entries` for every sourced projection (the durable
   * provenance + projection-capture store, sourced-content §2.5). The
   * upsert is idempotent on `(entity_module, entity_id)` and runs before
   * the indexer write. Owned projections are skipped — they live in the
   * vertical's owned schema, not the sourced-entry store.
   *
   * Optional only because pure-indexer test setups (no DB) want to use
   * `syncSources` for indexer-shape coverage. Production wiring always
   * passes a DB.
   */
  db?: AnyDrizzleDb
  /**
   * Optional adapter context override. Most adapters need at minimum
   * a `connection_id`; the demo plugin doesn't care so the default
   * `{ connection_id: adapter.kind }` is sufficient. Templates with
   * real connections pass their connection id (or build a per-adapter
   * map keyed by `kind`).
   */
  buildAdapterContext?: (adapter: SourceAdapter) => SourceAdapterContext
  /**
   * Optional wrapper around the per-projection `DocumentBuilder` — used
   * to attach embeddings via `withEmbedding` (the operator template's
   * helper) without coupling this orchestrator to any embedding
   * provider.
   */
  wrapBuilder?: (builder: DocumentBuilder) => DocumentBuilder
  /** Per-page log hook — called every page so callers can show progress. */
  onProgress?: (event: SyncProgressEvent) => void
}

export interface SyncProgressEvent {
  adapter: string
  page: number
  pageSize: number
  totalSoFar: number
}

export interface SyncAdapterSummary {
  adapter: string
  pages: number
  projectionsSynced: number
  /**
   * Verticals the adapter touched, derived from `entity_module` on
   * each projection. Useful for the CLI to print per-vertical counts.
   */
  verticalsTouched: string[]
  /**
   * Projections skipped because no field-policy registry was registered
   * for their `entity_module`. Common when an adapter declares more
   * verticals than the deployment indexes.
   */
  skippedNoRegistry: number
  /**
   * Projections that landed in `catalog_sourced_entries` (sourced rows
   * with a DB handle in scope). Owned projections are not counted —
   * they're not part of the sourced-entry store.
   */
  sourcedEntriesUpserted: number
  /**
   * Owned projections passed through unchanged. Owned-flagged
   * projections via `discover()` are an unusual case (most adapters
   * emit only sourced rows) but the orchestrator still routes them to
   * the indexer.
   */
  ownedProjections: number
}

export interface SyncSourcesSummary {
  adapters: SyncAdapterSummary[]
  totalProjections: number
}

/**
 * Run a one-shot discovery sync against every registered adapter.
 * Throws if an adapter doesn't support `discover` (a contract violation —
 * adapters wishing to participate in the sync must implement it).
 */
export async function syncSources(options: SyncSourcesOptions): Promise<SyncSourcesSummary> {
  // Iterate every registered (connection_id, adapter) pair — multiple
  // connections of the same kind each get their own discovery pass.
  // Skip adapters that don't implement `discover` (outbound-only
  // channel-push adapters).
  const entries = options.registry
    .connections()
    .map((connectionId) => ({
      connectionId,
      adapter: options.registry.resolveByConnectionOrThrow(connectionId),
    }))
    .filter((e) => typeof e.adapter.discover === "function")
  const adapterSummaries: SyncAdapterSummary[] = []
  let totalProjections = 0

  for (const { connectionId, adapter } of entries) {
    const adapterCtx = options.buildAdapterContext?.(adapter) ?? {
      connection_id: connectionId,
    }
    const summary: SyncAdapterSummary = {
      adapter: adapter.kind,
      pages: 0,
      projectionsSynced: 0,
      verticalsTouched: [],
      skippedNoRegistry: 0,
      sourcedEntriesUpserted: 0,
      ownedProjections: 0,
    }
    const verticals = new Set<string>()

    let cursor: string | undefined
    do {
      // `discover` is optional in the contract; the filter above
      // ensures we only iterate adapters that implement it.
      const page = await adapter.discover?.(adapterCtx, cursor)
      if (!page) break
      summary.pages += 1
      options.onProgress?.({
        adapter: adapter.kind,
        page: summary.pages,
        pageSize: page.projections.length,
        totalSoFar: summary.projectionsSynced + page.projections.length,
      })

      for (const projection of page.projections) {
        const registry = options.fieldPolicyRegistries.get(projection.entity_module)
        if (!registry) {
          summary.skippedNoRegistry += 1
          continue
        }

        verticals.add(projection.entity_module)

        // Durable sourced-entry capture (sourced-content §2.5.2).
        // Owned projections skip — they live in the vertical's owned
        // schema. Sourced projections upsert before the indexer write so
        // the sourced-entry store is the canonical local copy of what
        // discover() said for downstream synthesizer reads.
        if (isOwned(projection.provenance)) {
          summary.ownedProjections += 1
        } else if (options.db) {
          await upsertSourcedEntry(options.db, { projection })
          summary.sourcedEntriesUpserted += 1
        }

        const projectionMap = toProjectionMap(projection.fields)
        const baseBuilder: DocumentBuilder = async (
          _entityId: string,
          slice: IndexerSlice,
        ): Promise<IndexerDocument | null> =>
          buildIndexerDocument(registry, projectionMap, slice, projection.entity_id)
        const builder = options.wrapBuilder ? options.wrapBuilder(baseBuilder) : baseBuilder

        await options.indexerService.reindexEntity(
          projection.entity_module,
          projection.entity_id,
          builder,
        )
        summary.projectionsSynced += 1
        totalProjections += 1
      }

      cursor = page.next_cursor
    } while (cursor)

    summary.verticalsTouched = [...verticals]
    adapterSummaries.push(summary)
  }

  return { adapters: adapterSummaries, totalProjections }
}

function toProjectionMap(fields: Record<string, unknown>): ReadonlyMap<string, unknown> {
  return new Map(Object.entries(fields))
}
