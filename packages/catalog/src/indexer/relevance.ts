import type {
  IndexerAdapter,
  IndexerDocument,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"

/** A curated travel query with ordered, operator-approved relevant documents. */
export interface TravelRelevanceCase {
  id: string
  request: SearchRequest
  expectedIds: readonly string[]
}

/**
 * Small, reviewable corpus that protects travel-specific relevance behavior.
 * Deployments may extend it with operator-approved judgments before release.
 */
export const travelRelevanceCorpus: Readonly<{
  cases: readonly TravelRelevanceCase[]
  documents: readonly IndexerDocument[]
}> = {
  cases: [
    {
      expectedIds: ["destination-santorini"],
      id: "destination",
      request: { mode: "keyword", query: "Santorini" },
    },
    {
      expectedIds: ["destination-santorini"],
      id: "accent-alias",
      request: { mode: "keyword", query: "Thira" },
    },
    { expectedIds: ["hotel-crete"], id: "accent", request: { mode: "keyword", query: "Elounda" } },
    {
      expectedIds: ["ship-norwegian-viva"],
      id: "ship",
      request: { mode: "keyword", query: "Norwegian Viva" },
    },
    {
      expectedIds: ["destination-santorini"],
      id: "prefix",
      request: { mode: "keyword", query: "Santo" },
    },
    {
      expectedIds: ["destination-santorini"],
      id: "typo",
      request: { mode: "keyword", query: "Santoriny" },
    },
    {
      expectedIds: ["hotel-crete"],
      id: "filter-heavy",
      request: {
        filters: [
          { field: "market", kind: "eq", value: "GB" },
          { field: "price", gte: 200, lte: 500, kind: "range" },
        ],
        mode: "keyword",
        query: "Crete",
      },
    },
  ],
  documents: [
    {
      fields: {
        aliases: ["Thira", "Santoríni"],
        market: "GB",
        price: 420,
        title: "Santorini caldera escape",
      },
      id: "destination-santorini",
    },
    {
      fields: {
        aliases: ["Elounda"],
        market: "GB",
        price: 310,
        title: "Crete beach hotel",
      },
      id: "hotel-crete",
    },
    {
      fields: { market: "GB", price: 900, title: "Norwegian Viva Mediterranean cruise ship" },
      id: "ship-norwegian-viva",
    },
  ],
}

export interface RelevanceMetrics {
  ndcgAtK: number
  recallAtK: number
  zeroResultRate: number
}

export interface RelevanceReport {
  metrics: RelevanceMetrics
  results: ReadonlyMap<string, SearchResults>
}

export interface RelevanceComparison {
  baseline: RelevanceReport
  candidate: RelevanceReport
  /** Fraction of corpus cases whose requested facet buckets are identical. */
  facetParity: number
}

/**
 * Executes the same curated travel corpus against two adapter implementations.
 * It deliberately compares adapter-observable results instead of scores, which
 * are provider-local and cannot be compared across search engines.
 */
export async function compareTravelRelevance(input: {
  baseline: IndexerAdapter
  candidate: IndexerAdapter
  cases: readonly TravelRelevanceCase[]
  slice: IndexerSlice
  k?: number
}): Promise<RelevanceComparison> {
  const k = input.k ?? 10
  const [baseline, candidate] = await Promise.all([
    runTravelRelevance(input.baseline, input.slice, input.cases, k),
    runTravelRelevance(input.candidate, input.slice, input.cases, k),
  ])
  const matchedFacets = input.cases.filter((relevanceCase) =>
    facetsEqual(
      baseline.results.get(relevanceCase.id)?.facets,
      candidate.results.get(relevanceCase.id)?.facets,
    ),
  ).length
  return { baseline, candidate, facetParity: matchedFacets / (input.cases.length || 1) }
}

/** Run a travel corpus against one adapter and calculate portable metrics. */
export async function runTravelRelevance(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  cases: readonly TravelRelevanceCase[],
  k = 10,
): Promise<RelevanceReport> {
  if (!Number.isInteger(k) || k <= 0)
    throw new RangeError("Relevance k must be a positive integer.")
  const results = new Map<string, SearchResults>()
  let recall = 0
  let ndcg = 0
  let zeroResults = 0

  for (const relevanceCase of cases) {
    const result = await adapter.search(slice, relevanceCase.request)
    results.set(relevanceCase.id, result)
    const ids = result.hits.slice(0, k).map((hit) => hit.id)
    const expected = relevanceCase.expectedIds.slice(0, k)
    recall += recallAtK(ids, expected)
    ndcg += ndcgAtK(ids, expected)
    if (result.total === 0) zeroResults += 1
  }

  const denominator = cases.length || 1
  return {
    metrics: {
      ndcgAtK: ndcg / denominator,
      recallAtK: recall / denominator,
      zeroResultRate: zeroResults / denominator,
    },
    results,
  }
}

function recallAtK(actual: readonly string[], expected: readonly string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0
  const expectedSet = new Set(expected)
  return actual.filter((id) => expectedSet.has(id)).length / expectedSet.size
}

function ndcgAtK(actual: readonly string[], expected: readonly string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0
  const expectedRank = new Map(expected.map((id, index) => [id, index]))
  const dcg = actual.reduce((score, id, index) => {
    const relevance = expectedRank.has(id) ? expected.length - expectedRank.get(id)! : 0
    return score + relevance / Math.log2(index + 2)
  }, 0)
  const ideal = expected.reduce(
    (score, _id, index) => score + (expected.length - index) / Math.log2(index + 2),
    0,
  )
  return ideal === 0 ? 0 : dcg / ideal
}

function facetsEqual(left: SearchResults["facets"], right: SearchResults["facets"]): boolean {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {})
}
