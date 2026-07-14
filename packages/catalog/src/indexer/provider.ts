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
  const resolved = classifyCatalogIndexer(indexer)
  if (resolved.kind === "adapter") return resolved.value

  const adapter = resolved.value.create(options) as unknown
  if (!isIndexerAdapter(adapter)) {
    throw new Error("catalog.indexer provider create() must return a complete IndexerAdapter.")
  }
  return adapter
}

export const catalogIndexerProviderPort = definePort<CatalogIndexer>({
  id: "catalog.indexer",
  test(indexer) {
    classifyCatalogIndexer(indexer)
  },
})

const INDEXER_ADAPTER_METHODS = [
  "ensureCollection",
  "upsert",
  "delete",
  "search",
  "bulkReindex",
] as const
const INDEXER_ADAPTER_MEMBERS = ["capabilities", "admin", ...INDEXER_ADAPTER_METHODS] as const
const BOOLEAN_CAPABILITIES = [
  "supportsKeywordSearch",
  "supportsHybridSearch",
  "supportsVectorFields",
  "supportsCrossAudienceFederation",
  "supportsAdminDenormalization",
] as const

type ClassifiedCatalogIndexer =
  | { kind: "adapter"; value: IndexerAdapter }
  | { kind: "provider"; value: IndexerProvider }

function classifyCatalogIndexer(indexer: unknown): ClassifiedCatalogIndexer {
  if (isIndexerAdapter(indexer)) return { kind: "adapter", value: indexer }
  if (hasIndexerAdapterMembers(indexer)) {
    throw new Error("catalog.indexer contains an incomplete IndexerAdapter shape.")
  }
  if (isIndexerProvider(indexer)) return { kind: "provider", value: indexer }
  throw new Error("catalog.indexer must implement IndexerAdapter or IndexerProvider.create().")
}

function isIndexerProvider(indexer: unknown): indexer is IndexerProvider {
  return isRecord(indexer) && typeof indexer.create === "function"
}

function isIndexerAdapter(indexer: unknown): indexer is IndexerAdapter {
  if (!isRecord(indexer) || !isIndexerCapabilities(indexer.capabilities)) return false
  if (INDEXER_ADAPTER_METHODS.some((method) => typeof indexer[method] !== "function")) return false
  if (indexer.admin !== undefined) {
    if (!isRecord(indexer.admin)) return false
    for (const method of ["list", "drop", "scan"] as const) {
      if (typeof indexer.admin[method] !== "function") return false
    }
  }
  return true
}

function hasIndexerAdapterMembers(indexer: unknown): boolean {
  return isRecord(indexer) && INDEXER_ADAPTER_MEMBERS.some((member) => member in indexer)
}

function isIndexerCapabilities(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (BOOLEAN_CAPABILITIES.some((capability) => typeof value[capability] !== "boolean")) {
    return false
  }
  return (
    isNullableFiniteNumber(value.vectorDimensions) &&
    isNullableFiniteNumber(value.maxVectorsPerDocument)
  )
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}
