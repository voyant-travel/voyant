import type {
  IndexerAdapter,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"

import { compareTravelRelevance, runTravelRelevance } from "./relevance.js"

const slice: IndexerSlice = {
  audience: "customer",
  locale: "en-GB",
  market: "GB",
  vertical: "travel",
}

const capabilities = {
  maxVectorsPerDocument: null,
  supportsAdminDenormalization: true,
  supportsCrossAudienceFederation: true,
  supportsHybridSearch: false,
  supportsKeywordSearch: true,
  supportsVectorFields: false,
  vectorDimensions: null,
} as const

function adapter(results: Record<string, SearchResults>): IndexerAdapter {
  return {
    capabilities,
    async bulkReindex() {},
    async delete() {},
    async ensureCollection() {},
    async search(_slice: IndexerSlice, request: SearchRequest) {
      return results[request.query] ?? { hits: [], total: 0 }
    },
    async upsert() {},
  }
}

describe("travel relevance harness", () => {
  it("calculates portable ranking and zero-result metrics", async () => {
    const report = await runTravelRelevance(
      adapter({
        santorini: {
          hits: [
            { document: { fields: {}, id: "santorini" }, id: "santorini", score: 1 },
            { document: { fields: {}, id: "crete" }, id: "crete", score: 0.5 },
          ],
          total: 2,
        },
      }),
      slice,
      [
        {
          expectedIds: ["santorini", "crete"],
          id: "destination",
          request: { mode: "keyword", query: "santorini" },
        },
      ],
      2,
    )

    expect(report.metrics).toEqual({
      ndcgAtK: 1,
      recallAtK: 1,
      zeroResultRate: 0,
    })
  })

  it("compares independent adapter results without comparing provider scores", async () => {
    const comparison = await compareTravelRelevance({
      baseline: adapter({
        cruise: {
          hits: [{ document: { fields: {}, id: "ship" }, id: "ship", score: 0.1 }],
          total: 1,
        },
      }),
      candidate: adapter({ cruise: { hits: [], total: 0 } }),
      cases: [{ expectedIds: ["ship"], id: "ship", request: { mode: "keyword", query: "cruise" } }],
      slice,
    })

    expect(comparison.baseline.metrics.recallAtK).toBe(1)
    expect(comparison.candidate.metrics.zeroResultRate).toBe(1)
    expect(comparison.facetParity).toBe(1)
  })
})
