import type {
  IndexerAdapter,
  IndexerProvider,
  IndexerProviderOptions,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { definePort } from "@voyant-travel/core/project"

export type CatalogIndexer = IndexerAdapter | IndexerProvider

export function resolveCatalogIndexer(
  indexer: CatalogIndexer,
  options: IndexerProviderOptions,
): IndexerAdapter {
  return isIndexerProvider(indexer) ? indexer.create(options) : indexer
}

export const catalogIndexerProviderPort = definePort<CatalogIndexer>({
  id: "catalog.indexer",
  test(indexer) {
    if (isIndexerProvider(indexer) || isIndexerAdapter(indexer)) return
    throw new Error("catalog.indexer must implement IndexerAdapter or IndexerProvider.create().")
  },
})

function isIndexerProvider(indexer: CatalogIndexer): indexer is IndexerProvider {
  return typeof (indexer as Partial<IndexerProvider>)?.create === "function"
}

function isIndexerAdapter(indexer: CatalogIndexer): indexer is IndexerAdapter {
  if (!indexer || typeof indexer !== "object") return false
  const candidate = indexer as Partial<IndexerAdapter>
  if (!candidate.capabilities || typeof candidate.capabilities !== "object") return false
  for (const method of ["ensureCollection", "upsert", "delete", "search", "bulkReindex"] as const) {
    if (typeof candidate[method] !== "function") {
      return false
    }
  }
  return true
}
