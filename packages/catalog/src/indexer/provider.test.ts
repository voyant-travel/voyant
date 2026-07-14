import type {
  IndexerAdapter,
  IndexerProvider,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it, vi } from "vitest"

import { catalogIndexerProviderPort, resolveCatalogIndexer } from "./provider.js"

function createAdapter(): IndexerAdapter {
  return {
    capabilities: {
      supportsKeywordSearch: true,
      supportsHybridSearch: false,
      supportsVectorFields: false,
      vectorDimensions: null,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: false,
      supportsAdminDenormalization: false,
    },
    ensureCollection: vi.fn(async () => undefined),
    upsert: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    search: vi.fn(async () => ({ hits: [], total: 0 })),
    bulkReindex: vi.fn(async () => undefined),
  }
}

describe("catalogIndexerProviderPort", () => {
  it("accepts either a direct adapter or an adapter provider", () => {
    const adapter = createAdapter()
    const provider: IndexerProvider = { create: () => adapter }

    expect(() => catalogIndexerProviderPort.test(adapter)).not.toThrow()
    expect(() => catalogIndexerProviderPort.test(provider)).not.toThrow()
  })

  it("rejects values that implement neither indexer shape", () => {
    expect(() => catalogIndexerProviderPort.test({} as never)).toThrow(
      "catalog.indexer must implement IndexerAdapter or IndexerProvider.create().",
    )
  })
})

describe("resolveCatalogIndexer", () => {
  it("returns a direct adapter without wrapping it", () => {
    const adapter = createAdapter()

    expect(resolveCatalogIndexer(adapter, { registries: new Map() })).toBe(adapter)
  })

  it("creates an adapter from a provider", () => {
    const adapter = createAdapter()
    const create = vi.fn(() => adapter)
    const options = { registries: new Map(), vectorDimensions: 384 }

    expect(resolveCatalogIndexer({ create }, options)).toBe(adapter)
    expect(create).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(options)
  })
})
