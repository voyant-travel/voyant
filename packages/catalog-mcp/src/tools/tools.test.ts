import type {
  IndexerAdapter,
  IndexerCapabilities,
  SearchHit,
  SearchResults,
} from "@voyantjs/catalog"
import type { EmbeddingProvider } from "@voyantjs/catalog-rag"
import { describe, expect, it, vi } from "vitest"

import type {
  McpAvailabilityResult,
  McpQuoteResult,
  McpResolvedEntity,
  McpToolContext,
} from "../contract.js"
import { createMcpToolRegistry } from "../registry.js"
import { checkAvailabilityTool } from "./check-availability.js"
import { getEntityTool } from "./get-entity.js"
import { getQuoteTool } from "./get-quote.js"
import { searchCatalogTool } from "./search-catalog.js"
import { suggestAlternativesTool } from "./suggest-alternatives.js"

const indexerCapabilities: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: 3,
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: false,
  supportsAdminDenormalization: true,
}

function makeContext(overrides: Partial<McpToolContext["catalog"]> = {}): McpToolContext {
  return {
    actor: "staff",
    tenantId: "op_test",
    defaultScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    catalog: overrides,
  }
}

function hit(id: string, score: number, fields: Record<string, unknown> = {}): SearchHit {
  return { id, score, document: { id, fields: { id, ...fields } } }
}

function makeIndexer(hits: SearchHit[] = []): IndexerAdapter {
  return {
    capabilities: indexerCapabilities,
    async ensureCollection() {},
    async upsert() {},
    async delete() {},
    async bulkReindex() {},
    async search() {
      return { hits, total: hits.length } satisfies SearchResults
    },
  }
}

const stubEmbeddings: EmbeddingProvider = {
  capabilities: {
    modelId: "stub/v1",
    dimensions: 3,
    maxTokensPerInput: 1000,
    maxBatchSize: 100,
  },
  async embed(texts) {
    return texts.map(() => [0.1, 0.2, 0.3])
  },
}

describe("searchCatalogTool", () => {
  it("returns hits as text + structured content", async () => {
    const context = makeContext({
      indexer: makeIndexer([hit("a", 0.9, { title: "Alpha" }), hit("b", 0.7, { title: "Beta" })]),
      embeddings: stubEmbeddings,
    })
    const registry = createMcpToolRegistry({ context })
    registry.register(searchCatalogTool)

    const result = await registry.dispatchTool("search_catalog", {
      vertical: "products",
      query: "wellness",
      mode: "keyword",
    })
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.total).toBe(2)
    expect((result.structuredContent?.hits as Array<{ id: string }>)[0]?.id).toBe("a")
  })

  it("MISSING_SERVICE error when indexer not configured", async () => {
    const context = makeContext({ embeddings: stubEmbeddings })
    const registry = createMcpToolRegistry({ context })
    registry.register(searchCatalogTool)
    const result = await registry.dispatchTool("search_catalog", {
      vertical: "products",
      query: "wellness",
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "MISSING_SERVICE" })
  })

  it("MISSING_SERVICE for embeddings when mode requires them", async () => {
    const context = makeContext({ indexer: makeIndexer() })
    const registry = createMcpToolRegistry({ context })
    registry.register(searchCatalogTool)
    const result = await registry.dispatchTool("search_catalog", {
      vertical: "products",
      query: "x",
      mode: "semantic",
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "MISSING_SERVICE" })
  })
})

describe("getEntityTool", () => {
  it("returns the resolved view with title + description", async () => {
    const resolveEntity = vi.fn(
      async (vertical: string, entityId: string): Promise<McpResolvedEntity | null> => ({
        vertical,
        entityId,
        fields: { title: "Bali Wellness", description: "Source description" },
      }),
    )
    const context = makeContext({ resolveEntity })
    const registry = createMcpToolRegistry({ context })
    registry.register(getEntityTool)

    const result = await registry.dispatchTool("get_entity", {
      vertical: "products",
      entityId: "prod_xyz",
    })
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.entityId).toBe("prod_xyz")
    expect((result.structuredContent?.fields as Record<string, unknown>).title).toBe(
      "Bali Wellness",
    )
  })

  it("returns NOT_FOUND when the entity doesn't exist", async () => {
    const resolveEntity = vi.fn(async () => null)
    const context = makeContext({ resolveEntity })
    const registry = createMcpToolRegistry({ context })
    registry.register(getEntityTool)
    const result = await registry.dispatchTool("get_entity", {
      vertical: "products",
      entityId: "phantom",
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("suggestAlternativesTool", () => {
  it("excludes the seed entity from results", async () => {
    const resolveEntity = vi.fn(
      async (vertical: string, entityId: string): Promise<McpResolvedEntity | null> => ({
        vertical,
        entityId,
        fields: { title: "Bali Wellness", description: "yoga retreat" },
      }),
    )
    const context = makeContext({
      indexer: makeIndexer([
        hit("seed_xyz", 0.99, { title: "Bali Wellness" }),
        hit("alt_1", 0.85, { title: "Bali Yoga" }),
        hit("alt_2", 0.75, { title: "Ubud Spa" }),
      ]),
      embeddings: stubEmbeddings,
      resolveEntity,
    })
    const registry = createMcpToolRegistry({ context })
    registry.register(suggestAlternativesTool)

    const result = await registry.dispatchTool("suggest_alternatives", {
      vertical: "products",
      seedEntityId: "seed_xyz",
      limit: 5,
    })
    expect(result.isError).toBeUndefined()
    const alts = result.structuredContent?.alternatives as Array<{ id: string }>
    expect(alts).toHaveLength(2)
    expect(alts.map((a) => a.id)).not.toContain("seed_xyz")
  })

  it("returns NOT_FOUND when the seed entity doesn't exist", async () => {
    const context = makeContext({
      indexer: makeIndexer(),
      embeddings: stubEmbeddings,
      resolveEntity: async () => null,
    })
    const registry = createMcpToolRegistry({ context })
    registry.register(suggestAlternativesTool)
    const result = await registry.dispatchTool("suggest_alternatives", {
      vertical: "products",
      seedEntityId: "phantom",
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("checkAvailabilityTool", () => {
  it("calls the live availability function and surfaces availability", async () => {
    const checkAvailability = vi.fn(
      async (): Promise<McpAvailabilityResult> => ({
        available: true,
        details: { rooms_left: 3 },
        checkedAt: "2026-09-01T12:00:00Z",
      }),
    )
    const context = makeContext({ checkAvailability })
    const registry = createMcpToolRegistry({ context })
    registry.register(checkAvailabilityTool)

    const result = await registry.dispatchTool("check_availability", {
      vertical: "hospitality",
      entityId: "rmtp_xyz",
      parameters: { dates: "2026-10-15..2026-10-22" },
    })
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.available).toBe(true)
  })
})

describe("getQuoteTool", () => {
  it("returns the locked quote with expiry timestamp", async () => {
    const getQuote = vi.fn(
      async (): Promise<McpQuoteResult> => ({
        quoteId: "q_abc",
        totalPrice: { amount: "1500.00", currency: "EUR" },
        expiresAt: "2026-09-01T13:00:00Z",
      }),
    )
    const context = makeContext({ getQuote })
    const registry = createMcpToolRegistry({ context })
    registry.register(getQuoteTool)

    const result = await registry.dispatchTool("get_quote", {
      vertical: "products",
      entityId: "prod_xyz",
      parameters: { dates: "2026-10-15..2026-10-22", pax: 2 },
    })
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.quoteId).toBe("q_abc")
    expect((result.structuredContent?.totalPrice as { amount: string }).amount).toBe("1500.00")
  })

  it("MISSING_SERVICE when getQuote function not configured", async () => {
    const context = makeContext({})
    const registry = createMcpToolRegistry({ context })
    registry.register(getQuoteTool)
    const result = await registry.dispatchTool("get_quote", {
      vertical: "products",
      entityId: "x",
      parameters: {},
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "MISSING_SERVICE" })
  })
})
