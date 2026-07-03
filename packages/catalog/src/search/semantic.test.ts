import { describe, expect, it, vi } from "vitest"
import type { EmbeddingProvider } from "../embeddings/contract.js"
import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerSlice,
  SearchRequest,
} from "../indexer/contract.js"
import { executeBYOVectorSearch, executeSemanticSearch } from "./semantic.js"

function makeAdapter(capabilities: Partial<IndexerCapabilities> = {}): IndexerAdapter & {
  searchSpy: ReturnType<typeof vi.fn>
} {
  const baseCapabilities: IndexerCapabilities = {
    supportsKeywordSearch: true,
    supportsHybridSearch: true,
    supportsVectorFields: true,
    vectorDimensions: 1536,
    maxVectorsPerDocument: null,
    supportsCrossAudienceFederation: false,
    supportsAdminDenormalization: true,
    ...capabilities,
  }
  const searchSpy = vi.fn(async (_slice: IndexerSlice, _request: SearchRequest) => ({
    hits: [],
    total: 0,
  }))
  return {
    capabilities: baseCapabilities,
    async ensureCollection() {},
    async upsert() {},
    async delete() {},
    async bulkReindex() {},
    search: searchSpy,
    searchSpy,
  }
}

function makeEmbeddings(): EmbeddingProvider & { embedSpy: ReturnType<typeof vi.fn> } {
  const embedSpy = vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3] as number[]))
  return {
    capabilities: {
      modelId: "test/v1",
      dimensions: 3,
      maxTokensPerInput: 1000,
      maxBatchSize: 100,
    },
    embed: embedSpy,
    embedSpy,
  }
}

const slice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("executeSemanticSearch", () => {
  it("keyword mode delegates directly without embedding", async () => {
    const adapter = makeAdapter()
    const embeddings = makeEmbeddings()

    await executeSemanticSearch({
      adapter,
      embeddings,
      slice,
      request: { query: "wellness", mode: "keyword" },
    })

    expect(embeddings.embedSpy).not.toHaveBeenCalled()
    expect(adapter.searchSpy).toHaveBeenCalledTimes(1)
  })

  it("semantic mode embeds the query and attaches the vector", async () => {
    const adapter = makeAdapter()
    const embeddings = makeEmbeddings()

    await executeSemanticSearch({
      adapter,
      embeddings,
      slice,
      request: { query: "wellness", mode: "semantic" },
    })

    expect(embeddings.embedSpy).toHaveBeenCalledWith(["wellness"])
    const [, request] = adapter.searchSpy.mock.calls[0]!
    expect(request.query_embedding).toEqual([0.1, 0.2, 0.3])
    expect(request.query_embedding_model_id).toBe("test/v1")
  })

  it("hybrid mode embeds the query when caller didn't supply one", async () => {
    const adapter = makeAdapter()
    const embeddings = makeEmbeddings()

    await executeSemanticSearch({
      adapter,
      embeddings,
      slice,
      request: { query: "wellness", mode: "hybrid" },
    })

    expect(embeddings.embedSpy).toHaveBeenCalledTimes(1)
  })

  it("honors caller-supplied query_embedding without re-embedding", async () => {
    const adapter = makeAdapter()
    const embeddings = makeEmbeddings()
    const caller_vector = [0.9, 0.8, 0.7]

    await executeSemanticSearch({
      adapter,
      embeddings,
      slice,
      request: {
        query: "wellness",
        mode: "semantic",
        query_embedding: caller_vector,
      },
    })

    expect(embeddings.embedSpy).not.toHaveBeenCalled()
    const [, request] = adapter.searchSpy.mock.calls[0]!
    expect(request.query_embedding).toBe(caller_vector)
    expect(request.query_embedding_model_id).toBe("test/v1")
  })

  it("preserves an explicit query embedding model id", async () => {
    const adapter = makeAdapter()
    const embeddings = makeEmbeddings()
    const caller_vector = [0.9, 0.8, 0.7]

    await executeSemanticSearch({
      adapter,
      embeddings,
      slice,
      request: {
        query: "wellness",
        mode: "semantic",
        query_embedding: caller_vector,
        query_embedding_model_id: "external/model/v2",
      },
    })

    const [, request] = adapter.searchSpy.mock.calls[0]!
    expect(request.query_embedding_model_id).toBe("external/model/v2")
  })

  it("throws when semantic mode is requested but adapter doesn't support vectors", async () => {
    const adapter = makeAdapter({ supportsVectorFields: false })
    const embeddings = makeEmbeddings()

    await expect(
      executeSemanticSearch({
        adapter,
        embeddings,
        slice,
        request: { query: "x", mode: "semantic" },
      }),
    ).rejects.toThrow(/supports vector fields/)
  })

  it("throws when hybrid mode is requested but adapter doesn't support hybrid", async () => {
    const adapter = makeAdapter({ supportsVectorFields: true, supportsHybridSearch: false })
    const embeddings = makeEmbeddings()

    await expect(
      executeSemanticSearch({
        adapter,
        embeddings,
        slice,
        request: { query: "x", mode: "hybrid" },
      }),
    ).rejects.toThrow(/supportsHybridSearch/)
  })
})

describe("executeBYOVectorSearch", () => {
  it("attaches the caller-supplied vector and delegates without embedding", async () => {
    const adapter = makeAdapter()
    const vector = [1, 2, 3]

    await executeBYOVectorSearch({
      adapter,
      slice,
      request: { query: "x", mode: "semantic", query_embedding: vector },
    })

    const [, request] = adapter.searchSpy.mock.calls[0]!
    expect(request.query_embedding).toBe(vector)
  })

  it("throws when adapter does not support vector fields", async () => {
    const adapter = makeAdapter({ supportsVectorFields: false })
    await expect(
      executeBYOVectorSearch({
        adapter,
        slice,
        request: { query: "x", mode: "semantic", query_embedding: [1, 2, 3] },
      }),
    ).rejects.toThrow(/supportsVectorFields/)
  })
})
