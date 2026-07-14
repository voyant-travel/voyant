/**
 * Cross-audience federated search.
 *
 * Per architecture §7, vectors are strictly per-audience — customer
 * embedding pools only contain customer-visible text, partner pools only
 * contain partner-visible text, etc. This means the most common admin AI
 * use case ("find products similar to *X*" where *X* is in customer-
 * facing language) needs to query a non-staff audience pool.
 *
 * Staff actors are authorized to query any audience pool; customer /
 * partner / supplier agents are pinned to their own audience by API
 * authorization. This helper takes a list of `search_audiences` and:
 *
 *   1. Verifies the actor is authorized for each requested audience.
 *   2. Issues parallel `IndexerAdapter.search` calls — one per audience.
 *   3. Deduplicates hits by entity id (same entity may rank in multiple
 *      pools; keep the highest-scoring instance).
 *   4. Merges the per-pool result sets into a single ranked list.
 *
 * If the adapter declares `supportsCrossAudienceFederation`, the helper
 * delegates to a single multi-collection adapter call instead of fanning
 * out client-side. Either way the API contract is the same to callers.
 *
 * See `docs/architecture/catalog-architecture.md` for the design.
 */

import type {
  IndexerAdapter,
  IndexerSlice,
  SearchHit,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import type { Visibility } from "../contract.js"

export interface FederatedSearchOptions {
  adapter: IndexerAdapter
  /**
   * The actor making the request. The federation helper enforces:
   *   - `customer` / `partner` / `supplier` actors → may search only
   *     their own audience pool (no federation).
   *   - `staff` actors → may search any combination of audience pools.
   */
  actor: Visibility
  /** The audience pools to federate across. Must be a subset of allowed pools per actor. */
  searchAudiences: Visibility[]
  /** The vertical (entity_module) to search. */
  vertical: string
  /** Locale + market for every slice. */
  locale: string
  market: string
  /** The base search request — same shape passed to a single-slice search. */
  request: SearchRequest
}

/**
 * Federate a search across multiple audience pools. Returns a unified
 * `SearchResults` with deduplicated hits ranked by score.
 */
export async function federateAudienceSearch(
  options: FederatedSearchOptions,
): Promise<SearchResults> {
  const { adapter, actor, searchAudiences, vertical, locale, market, request } = options

  if (searchAudiences.length === 0) {
    throw new Error("federateAudienceSearch requires at least one searchAudience")
  }

  enforceAudienceAuthorization(actor, searchAudiences)

  // If a single audience is requested, no federation needed — direct search.
  if (searchAudiences.length === 1) {
    const audience = searchAudiences[0]!
    const slice: IndexerSlice = { vertical, locale, audience, market }
    return adapter.search(slice, request)
  }

  // Engine-side federation when supported — single adapter call.
  if (adapter.capabilities.supportsCrossAudienceFederation) {
    // The adapter contract doesn't currently expose multi-slice search
    // directly. For Phase 2 v1 we use the client-side fan-out path below
    // even when the engine could do better. A follow-up adds a
    // `searchFederated(slices: IndexerSlice[], request)` method to the
    // contract to take advantage of native federation.
    // For now, fall through to the client-side path.
  }

  // Client-side fan-out: one search per audience pool, parallelized.
  const slices: IndexerSlice[] = searchAudiences.map((audience) => ({
    vertical,
    locale,
    audience,
    market,
  }))

  const perSliceResults = await Promise.all(slices.map((slice) => adapter.search(slice, request)))

  return mergeAndDedupe(perSliceResults, request.pagination?.limit)
}

/**
 * Merge several `SearchResults` into one, deduplicating by hit id and
 * keeping the highest-scoring instance. Total is the count of unique ids
 * across all pools (after dedupe).
 */
export function mergeAndDedupe(
  perSlice: ReadonlyArray<SearchResults>,
  limit?: number,
): SearchResults {
  const byId = new Map<string, SearchHit>()
  for (const result of perSlice) {
    for (const hit of result.hits) {
      const existing = byId.get(hit.id)
      if (!existing || hit.score > existing.score) {
        byId.set(hit.id, hit)
      }
    }
  }

  // Sort by score descending — federated semantics rank by best score.
  const merged = Array.from(byId.values()).sort((a, b) => b.score - a.score)
  const limited = limit != null ? merged.slice(0, limit) : merged

  return {
    hits: limited,
    total: byId.size,
    // Facets aren't merged — federation across audiences with different
    // facet vocabularies is ambiguous. Callers that need facets should
    // search a single audience.
  }
}

/**
 * Enforce per-actor authorization rules: customer / partner / supplier
 * agents may only search their own audience pool. Staff actors may
 * federate across any pools.
 */
function enforceAudienceAuthorization(actor: Visibility, requested: Visibility[]): void {
  if (actor === "staff") {
    // Staff may federate across anything.
    return
  }
  if (requested.length === 1 && requested[0] === actor) {
    // Non-staff actor searching their own pool only — allowed.
    return
  }
  throw new Error(
    `Actor "${actor}" is not authorized to federate across audiences ${JSON.stringify(requested)}. ` +
      `Non-staff actors may only search their own audience pool. To federate across audiences, the request must come from a staff actor.`,
  )
}
