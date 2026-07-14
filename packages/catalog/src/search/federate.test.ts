import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerSlice,
  SearchHit,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"

import { federateAudienceSearch, mergeAndDedupe } from "./federate.js"

const capabilities: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: 1536,
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: false,
  supportsAdminDenormalization: true,
}

function hit(id: string, score: number): SearchHit {
  return { id, score, document: { id, fields: {} } }
}

function makeAdapter(perAudience: Record<string, SearchHit[]>): IndexerAdapter {
  return {
    capabilities,
    async ensureCollection() {},
    async upsert() {},
    async delete() {},
    async bulkReindex() {},
    async search(slice: IndexerSlice) {
      const hits = perAudience[slice.audience] ?? []
      return { hits, total: hits.length } satisfies SearchResults
    },
  }
}

describe("mergeAndDedupe", () => {
  it("keeps the highest-scoring instance when an entity appears in multiple pools", () => {
    const merged = mergeAndDedupe([
      { hits: [hit("a", 1), hit("b", 2)], total: 2 },
      { hits: [hit("a", 5), hit("c", 3)], total: 2 },
    ])
    const ids = merged.hits.map((h) => h.id)
    expect(ids).toEqual(["a", "c", "b"]) // sorted by score desc
    const aHit = merged.hits.find((h) => h.id === "a")
    expect(aHit?.score).toBe(5)
    expect(merged.total).toBe(3)
  })

  it("respects the limit parameter", () => {
    const merged = mergeAndDedupe([{ hits: [hit("a", 1), hit("b", 2), hit("c", 3)], total: 3 }], 2)
    expect(merged.hits).toHaveLength(2)
    expect(merged.total).toBe(3) // total is unique-id count, not limited
  })

  it("returns an empty result when no pools have hits", () => {
    const merged = mergeAndDedupe([])
    expect(merged.hits).toEqual([])
    expect(merged.total).toBe(0)
  })
})

describe("federateAudienceSearch — authorization", () => {
  it("rejects non-staff actors trying to federate beyond their own pool", async () => {
    const adapter = makeAdapter({})
    await expect(
      federateAudienceSearch({
        adapter,
        actor: "customer",
        searchAudiences: ["customer", "partner"],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword" },
      }),
    ).rejects.toThrow(/not authorized to federate/)
  })

  it("allows non-staff actors to search their own audience pool only", async () => {
    const adapter = makeAdapter({ customer: [hit("a", 1)] })
    const result = await federateAudienceSearch({
      adapter,
      actor: "customer",
      searchAudiences: ["customer"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "x", mode: "keyword" },
    })
    expect(result.hits).toHaveLength(1)
  })

  it("rejects non-staff actors trying to search a different audience pool", async () => {
    const adapter = makeAdapter({})
    await expect(
      federateAudienceSearch({
        adapter,
        actor: "customer",
        searchAudiences: ["partner"],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword" },
      }),
    ).rejects.toThrow(/not authorized to federate/)
  })

  it("allows staff actors to federate across multiple audience pools", async () => {
    const adapter = makeAdapter({
      customer: [hit("a", 1)],
      partner: [hit("b", 2)],
    })
    const result = await federateAudienceSearch({
      adapter,
      actor: "staff",
      searchAudiences: ["customer", "partner"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "x", mode: "keyword" },
    })
    expect(result.hits.map((h) => h.id).sort()).toEqual(["a", "b"])
    expect(result.total).toBe(2)
  })
})

describe("federateAudienceSearch — single audience shortcut", () => {
  it("issues a single adapter call when only one audience is requested", async () => {
    let callCount = 0
    const wrapped: IndexerAdapter = {
      capabilities,
      async ensureCollection() {},
      async upsert() {},
      async delete() {},
      async bulkReindex() {},
      async search(slice) {
        callCount++
        return { hits: [hit(`from-${slice.audience}`, 1)], total: 1 }
      },
    }
    await federateAudienceSearch({
      adapter: wrapped,
      actor: "staff",
      searchAudiences: ["customer"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "x", mode: "keyword" },
    })
    expect(callCount).toBe(1)
  })
})

describe("federateAudienceSearch — empty input rejected", () => {
  it("requires at least one searchAudience", async () => {
    const adapter = makeAdapter({})
    await expect(
      federateAudienceSearch({
        adapter,
        actor: "staff",
        searchAudiences: [],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword" },
      }),
    ).rejects.toThrow(/at least one searchAudience/)
  })
})
