/**
 * Provider-agnostic external cruise catalog refresh.
 *
 * Reconciles both local browse/search projections (`cruise_search_index`) and,
 * when catalog runtime dependencies are supplied, catalog sourced entries plus
 * catalog search slices. The service never imports a concrete provider.
 */

import type { DocumentBuilder, FieldPolicyRegistry, IndexerService } from "@voyant-travel/catalog"
import {
  type SourceAdapterRegistry,
  type SyncProgressEvent,
  type SyncSourcesSummary,
  syncSources,
} from "@voyant-travel/catalog/booking-engine"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { listCruiseAdapters } from "./adapters/registry.js"
import { cruisesSearchService, type ExternalAdapterRefreshResult } from "./service-search.js"

export interface ExternalCruiseCatalogRefreshOptions {
  db: PostgresJsDatabase
  /**
   * Optional catalog source registry. Supplying it lets the refresh update
   * `catalog_sourced_entries` and catalog search slices from cruise shims.
   */
  sourceAdapterRegistry?: SourceAdapterRegistry
  indexerService?: IndexerService
  fieldPolicyRegistries?: ReadonlyMap<string, FieldPolicyRegistry>
  wrapCatalogBuilder?: (builder: DocumentBuilder) => DocumentBuilder
  onCatalogProgress?: (event: SyncProgressEvent) => void
}

export interface ExternalCruiseCatalogRefreshResult {
  cruiseSearchIndex: {
    adapters: Array<
      {
        adapter: string
      } & ExternalAdapterRefreshResult
    >
    upserted: number
    removed: number
    errors: Array<{ adapter: string; error: string }>
  }
  catalog?: SyncSourcesSummary
}

export async function refreshExternalCruiseCatalog(
  options: ExternalCruiseCatalogRefreshOptions,
): Promise<ExternalCruiseCatalogRefreshResult> {
  const adapters = listCruiseAdapters()
  const cruiseSearchIndex: ExternalCruiseCatalogRefreshResult["cruiseSearchIndex"] = {
    adapters: [],
    upserted: 0,
    removed: 0,
    errors: [],
  }

  for (const adapter of adapters) {
    try {
      const result = await cruisesSearchService.refreshExternalForAdapter(options.db, adapter)
      cruiseSearchIndex.adapters.push({ adapter: adapter.name, ...result })
      cruiseSearchIndex.upserted += result.upserted
      cruiseSearchIndex.removed += result.removed
    } catch (err) {
      cruiseSearchIndex.errors.push({
        adapter: adapter.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  let catalog: SyncSourcesSummary | undefined
  if (options.sourceAdapterRegistry && options.indexerService && options.fieldPolicyRegistries) {
    catalog = await syncSources({
      registry: options.sourceAdapterRegistry,
      indexerService: options.indexerService,
      fieldPolicyRegistries: options.fieldPolicyRegistries,
      db: options.db,
      verticals: ["cruises"],
      pruneMissing: true,
      ...(options.wrapCatalogBuilder ? { wrapBuilder: options.wrapCatalogBuilder } : {}),
      ...(options.onCatalogProgress ? { onProgress: options.onCatalogProgress } : {}),
    })
  }

  return { cruiseSearchIndex, ...(catalog ? { catalog } : {}) }
}
