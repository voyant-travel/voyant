import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerSlice,
  SearchHit,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_FEDERATED_CANDIDATE_DEPTH,
  federateAudienceSearch,
  MAX_FEDERATED_CANDIDATE_DEPTH,
  mergeAndDedupe,
} from "./federate.js"

const capabilities: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: 1536,
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: false,
  supportsAdminDenormalization: true,
}

function hit(id: string, score: number, audience?: string): SearchHit {
  return { id, score, document: { id, fields: { ...(audience ? { audience } : {}) } } }
}

function makeAdapter(
  perAudience: Record<string, SearchHit[]>,
  onSearch?: (slice: IndexerSlice, request: SearchRequest) => void,
): IndexerAdapter {
  return {
    capabilities,
    async ensureCollection() {},
    async upsert() {},
    async delete() {},
    async bulkReindex() {},
    async search(slice: IndexerSlice, request: SearchRequest) {
      onSearch?.(slice, request)
      const allHits = perAudience[slice.audience] ?? []
      const offset = Number(request.pagination?.cursor ?? 0)
      const limit = request.pagination?.limit ?? 20
      const hits = allHits.slice(offset, offset + limit)
      const nextOffset = offset + hits.length
      return {
        hits,
        total: allHits.length,
        ...(nextOffset < allHits.length ? { next_cursor: String(nextOffset) } : {}),
      } satisfies SearchResults
    },
  }
}

describe("mergeAndDedupe", () => {
  it("fuses ordered ranks and keeps the duplicate representative from its best rank", () => {
    const merged = mergeAndDedupe([
      { hits: [hit("a", 0.9, "customer"), hit("b", 0.8)], total: 2 },
      { hits: [hit("c", 900), hit("a", 800, "partner")], total: 2 },
    ])
    expect(merged.hits.map(({ id }) => id)).toEqual(["a", "c", "b"])
    const aHit = merged.hits.find((h) => h.id === "a")
    expect(aHit?.document.fields.audience).toBe("customer")
    expect(aHit?.score).toBeCloseTo(1 / 61 + 1 / 62)
    expect(merged.total).toBe(3)
    expect(merged.totalRelation).toBe("eq")
  })

  it("respects the limit parameter", () => {
    const merged = mergeAndDedupe([{ hits: [hit("a", 3), hit("b", 2), hit("c", 1)], total: 3 }], 2)
    expect(merged.hits).toHaveLength(2)
    expect(merged.total).toBe(3) // total is unique-id count, not limited
    expect(merged.totalRelation).toBe("eq")
  })

  it("breaks equal fused ranks by input-slice order", () => {
    const merged = mergeAndDedupe([
      { hits: [hit("near", 1), hit("first-tie", 0.5)], total: 2 },
      { hits: [hit("second-tie", 0.5), hit("far", 0)], total: 2 },
    ])

    expect(merged.hits.map(({ id }) => id)).toEqual(["near", "second-tie", "first-tie", "far"])
    expect(merged.hits.map(({ score }) => score)).toEqual([1 / 61, 1 / 61, 1 / 62, 1 / 62])
  })

  it("returns an empty result when no pools have hits", () => {
    const merged = mergeAndDedupe([])
    expect(merged.hits).toEqual([])
    expect(merged.total).toBe(0)
    expect(merged.totalRelation).toBe("eq")
  })
})

describe("federateAudienceSearch — ranked modes", () => {
  it("fuses semantic rankings across two audience slices without comparing raw scores", async () => {
    const adapter = makeAdapter({
      customer: [hit("shared", 0.9, "customer"), hit("customer-only", 0.8, "customer")],
      partner: [hit("partner-only", 9000, "partner"), hit("shared", 8000, "partner")],
    })

    const result = await federateAudienceSearch({
      adapter,
      actor: "staff",
      searchAudiences: ["customer", "partner"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "coastal", mode: "semantic", query_embedding: [1, 0, 0] },
    })

    expect(result.hits.map(({ id }) => id)).toEqual(["shared", "partner-only", "customer-only"])
    expect(result.hits[0]?.document.fields.audience).toBe("customer")
    expect(result.hits[0]!.score).toBeGreaterThan(result.hits[1]!.score)
    expect(result.total).toBe(3)
    expect(result.totalRelation).toBe("eq")
  })

  it("fuses hybrid rankings and resolves an equal-rank duplicate by audience order", async () => {
    const adapter = makeAdapter({
      customer: [
        hit("customer-only", 0.9, "customer"),
        hit("shared", 0.8, "customer"),
        hit("customer-tail", 0.7, "customer"),
      ],
      partner: [
        hit("partner-only", 9000, "partner"),
        hit("shared", 8000, "partner"),
        hit("partner-tail", 7000, "partner"),
      ],
    })

    const result = await federateAudienceSearch({
      adapter,
      actor: "staff",
      searchAudiences: ["customer", "partner"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: {
        query: "coastal",
        mode: "hybrid",
        query_embedding: [1, 0, 0],
        alpha: 0.5,
      },
    })

    expect(result.hits.map(({ id }) => id)).toEqual([
      "shared",
      "customer-only",
      "partner-only",
      "customer-tail",
      "partner-tail",
    ])
    expect(result.hits[0]?.document.fields.audience).toBe("customer")
    expect(result.hits[0]!.score).toBeCloseTo(2 / 62)
    expect(result.total).toBe(5)
    expect(result.totalRelation).toBe("eq")
  })

  it("fetches beyond output limit so a below-cutoff duplicate can win fusion", async () => {
    const requestedLimits: number[] = []
    const adapter = makeAdapter(
      {
        customer: [hit("customer-first", 0.9), hit("shared", 0.8, "customer")],
        partner: [hit("partner-first", 9000), hit("shared", 8000, "partner")],
      },
      (_slice, request) => requestedLimits.push(request.pagination?.limit ?? 0),
    )

    const result = await federateAudienceSearch({
      adapter,
      actor: "staff",
      searchAudiences: ["customer", "partner"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "coastal", mode: "semantic", pagination: { limit: 1 } },
    })

    expect(requestedLimits).toEqual([
      DEFAULT_FEDERATED_CANDIDATE_DEPTH,
      DEFAULT_FEDERATED_CANDIDATE_DEPTH,
    ])
    expect(result.hits.map(({ id }) => id)).toEqual(["shared"])
    expect(result.total).toBe(3)
    expect(result.totalRelation).toBe("eq")
  })

  it("marks total as a lower bound when candidate pages are truncated", async () => {
    const adapter = makeAdapter({
      customer: [hit("customer-first", 0.9), hit("shared", 0.8), hit("customer-tail", 0.7)],
      partner: [hit("partner-first", 9000), hit("shared", 8000), hit("partner-tail", 7000)],
    })

    const result = await federateAudienceSearch({
      adapter,
      actor: "staff",
      searchAudiences: ["customer", "partner"],
      vertical: "products",
      locale: "en-GB",
      market: "default",
      request: { query: "coastal", mode: "hybrid", pagination: { limit: 1 } },
      candidateDepthPerAudience: 2,
    })

    expect(result.hits.map(({ id }) => id)).toEqual(["shared"])
    expect(result.total).toBe(3)
    expect(result.totalRelation).toBe("gte")
  })
})

describe("federateAudienceSearch — bounded pagination", () => {
  it("rejects cursor pagination before searching any audience", async () => {
    let searchCalls = 0
    const adapter = makeAdapter({}, () => {
      searchCalls += 1
    })

    await expect(
      federateAudienceSearch({
        adapter,
        actor: "staff",
        searchAudiences: ["customer", "partner"],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword", pagination: { limit: 10, cursor: "next" } },
      }),
    ).rejects.toThrow("Federated cursor pagination is unsupported")
    expect(searchCalls).toBe(0)
  })

  it("enforces the per-audience hard cap for configuration and output", async () => {
    const adapter = makeAdapter({})
    expect(MAX_FEDERATED_CANDIDATE_DEPTH).toBe(250)

    await expect(
      federateAudienceSearch({
        adapter,
        actor: "staff",
        searchAudiences: ["customer", "partner"],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword" },
        candidateDepthPerAudience: 251,
      }),
    ).rejects.toThrow("candidateDepthPerAudience may not exceed 250")

    await expect(
      federateAudienceSearch({
        adapter,
        actor: "staff",
        searchAudiences: ["customer", "partner"],
        vertical: "products",
        locale: "en-GB",
        market: "default",
        request: { query: "x", mode: "keyword", pagination: { limit: 251 } },
      }),
    ).rejects.toThrow("request.pagination.limit may not exceed 250")
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
