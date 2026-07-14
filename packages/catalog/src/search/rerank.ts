/**
 * Tier 2 two-stage-search rerank helper for browse-time pricing.
 *
 * Storefront BFFs use this for "refresh prices for these dates" actions and
 * other high-intent queries where Tier 1 indexed price summaries are too
 * approximate. The pattern: indexer returns top-N candidates ranked by
 * cached price; this helper calls the source adapter's live-pricing
 * operation for those candidates with the customer's exact dates /
 * occupancy / market / currency, then resorts.
 *
 * v1 ships the helper but storefronts opt in per query — never always-on.
 *
 * See `docs/architecture/catalog-architecture.md` §5.4.3 Tier 2 for design.
 */

import type { SearchHit, SearchResults } from "@voyant-travel/catalog-contracts/indexer/contract"

/**
 * The live-pricing function the storefront BFF supplies. Receives a batch
 * of candidate ids (typically top-N from the indexer) plus the rerank
 * parameters (dates / occupancy / market / currency); returns a per-id
 * price map.
 *
 * Implementations route per-id calls to the right source adapter — the BFF
 * knows which adapter owns each entity from the catalog plane's provenance.
 */
export type LivePriceFn = (
  ids: string[],
  parameters: RerankParameters,
) => Promise<Map<string, LivePriceResult>>

/** Parameters that scope the live-pricing rerank. Shape is vertical-agnostic. */
export interface RerankParameters {
  dates?: { start: string; end: string }
  occupancy?: Record<string, number>
  market: string
  currency: string
  /** Per-source timeout in milliseconds. Defaults vary by storefront. */
  perSourceTimeoutMs?: number
}

/**
 * Result of a single live-pricing call. The price source is captured so
 * downstream consumers can mark stale fallbacks.
 */
export interface LivePriceResult {
  amount: number
  currency: string
  source: "live" | "stale"
}

/** Reranked hit with the price provenance attached. */
export interface RerankedHit extends SearchHit {
  /** The live-resolved price; may be the indexed fallback if live timed out. */
  rerankedPrice?: LivePriceResult
}

export interface RerankOptions {
  /**
   * Top-N to pass through the live-pricing path. Default 100; bounded so the
   * rerank cost stays predictable.
   */
  topN?: number
  /**
   * If true, hits without a successful live price drop to the bottom of the
   * sorted result. If false (default), they keep their indexer-ranked order
   * but carry a `priceSource: "stale"` marker in `rerankedPrice`.
   */
  dropOnLiveMiss?: boolean
}

/**
 * Reranks indexer results against live source pricing. The hit list is
 * narrowed to `topN`, live-priced via the supplied function, resorted by
 * live price, and merged back with the un-reranked tail (which keeps its
 * indexer ranking).
 *
 * Failures from the live function are caught individually — one timing-out
 * source does not tank the rerank.
 */
export async function rerank(
  results: SearchResults,
  livePrice: LivePriceFn,
  parameters: RerankParameters,
  options: RerankOptions = {},
): Promise<SearchResults & { hits: RerankedHit[] }> {
  const topN = options.topN ?? 100
  const head = results.hits.slice(0, topN)
  const tail = results.hits.slice(topN)
  const headIds = head.map((h) => h.id)

  let priceMap: Map<string, LivePriceResult>
  try {
    priceMap = await livePrice(headIds, parameters)
  } catch {
    // Live call failed entirely. Return the indexer-ranked results unchanged.
    return { ...results, hits: head.concat(tail) }
  }

  // Attach prices to hits.
  const reranked: RerankedHit[] = head.map((hit) => {
    const price = priceMap.get(hit.id)
    return price ? { ...hit, rerankedPrice: price } : { ...hit }
  })

  // Filter / order:
  //   - hits with live prices sort by price ascending
  //   - hits with stale fallback sort after the live ones (stable order)
  //   - hits with no price are dropped or kept based on dropOnLiveMiss
  const live: RerankedHit[] = []
  const stale: RerankedHit[] = []
  const missing: RerankedHit[] = []
  for (const hit of reranked) {
    if (!hit.rerankedPrice) {
      missing.push(hit)
    } else if (hit.rerankedPrice.source === "live") {
      live.push(hit)
    } else {
      stale.push(hit)
    }
  }
  live.sort((a, b) => a.rerankedPrice!.amount - b.rerankedPrice!.amount)

  const headOut: RerankedHit[] = options.dropOnLiveMiss
    ? [...live, ...stale]
    : [...live, ...stale, ...missing]

  return {
    ...results,
    hits: [...headOut, ...tail],
  }
}
