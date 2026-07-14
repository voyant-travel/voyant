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
 *      pools; keep the representative from its best per-pool rank).
 *   4. Uses reciprocal-rank fusion to merge per-pool orderings without
 *      comparing provider scores produced by independent queries.
 *
 * The current adapter surface has no multi-slice method, so this helper always
 * fans out. A future native path must preserve the same observable ranking and
 * deduplication semantics.
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

/** Default number of ranked candidates fetched from each audience pool. */
export const DEFAULT_FEDERATED_CANDIDATE_DEPTH = 50

/** Hard bound on candidates fetched from any one audience pool. */
export const MAX_FEDERATED_CANDIDATE_DEPTH = 250

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
  /**
   * Ranked candidates fetched per audience before fusion. Defaults to
   * {@link DEFAULT_FEDERATED_CANDIDATE_DEPTH}, rises to the requested output
   * limit when needed, and may not exceed {@link MAX_FEDERATED_CANDIDATE_DEPTH}.
   */
  candidateDepthPerAudience?: number
}

/**
 * Federate a search across multiple audience pools. Returns a unified
 * `SearchResults` with deduplicated hits ranked by a fused score.
 */
export async function federateAudienceSearch(
  options: FederatedSearchOptions,
): Promise<SearchResults> {
  const {
    adapter,
    actor,
    searchAudiences,
    vertical,
    locale,
    market,
    request,
    candidateDepthPerAudience,
  } = options

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

  if (request.pagination?.cursor !== undefined) {
    throw new Error(
      "Federated cursor pagination is unsupported because bounded rank fusion has no exact continuation cursor",
    )
  }
  const outputLimit = request.pagination?.limit
  const candidateDepth = resolveCandidateDepth(candidateDepthPerAudience, outputLimit)

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

  const candidateRequest: SearchRequest = {
    ...request,
    pagination: { limit: candidateDepth },
  }
  const perSliceResults = await Promise.all(
    slices.map((slice) => adapter.search(slice, candidateRequest)),
  )

  return mergeAndDedupe(perSliceResults, outputLimit)
}

/**
 * Merge ordered `SearchResults` with reciprocal-rank fusion. Provider scores
 * are intentionally ignored because independently executed queries do not
 * share a score scale. Duplicate ids accumulate one contribution per result
 * list. Their representative hit comes from the best rank, with earlier input
 * lists breaking equal-rank ties. The returned score is the larger-is-better
 * fused score. `total` is the number of unique fetched candidates. It is exact
 * only when every input result is exhausted; otherwise `totalRelation: "gte"`
 * marks it as a lower bound and avoids pretending bounded fusion saw all hits.
 */
export function mergeAndDedupe(
  perSlice: ReadonlyArray<SearchResults>,
  limit?: number,
): SearchResults {
  const byId = new Map<string, FusedHit>()
  for (const [sliceIndex, result] of perSlice.entries()) {
    const seenInSlice = new Set<string>()
    for (const [hitIndex, hit] of result.hits.entries()) {
      if (seenInSlice.has(hit.id)) continue
      seenInSlice.add(hit.id)
      const rank = hitIndex + 1
      const existing = byId.get(hit.id)
      if (!existing) {
        byId.set(hit.id, {
          representative: hit,
          bestRank: rank,
          representativeSlice: sliceIndex,
          firstSeen: byId.size,
          fusedScore: reciprocalRank(rank),
        })
        continue
      }

      existing.fusedScore += reciprocalRank(rank)
      if (
        rank < existing.bestRank ||
        (rank === existing.bestRank && sliceIndex < existing.representativeSlice)
      ) {
        existing.representative = hit
        existing.bestRank = rank
        existing.representativeSlice = sliceIndex
      }
    }
  }

  const merged = Array.from(byId.values())
    .sort(
      (left, right) =>
        right.fusedScore - left.fusedScore ||
        left.bestRank - right.bestRank ||
        left.representativeSlice - right.representativeSlice ||
        left.firstSeen - right.firstSeen,
    )
    .map(({ representative, fusedScore }) => ({ ...representative, score: fusedScore }))
  const limited = limit != null ? merged.slice(0, limit) : merged

  return {
    hits: limited,
    total: byId.size,
    totalRelation: perSlice.every(isExhaustedResult) ? "eq" : "gte",
    // Facets aren't merged — federation across audiences with different
    // facet vocabularies is ambiguous. Callers that need facets should
    // search a single audience.
  }
}

const RECIPROCAL_RANK_FUSION_K = 60

interface FusedHit {
  representative: SearchHit
  bestRank: number
  representativeSlice: number
  firstSeen: number
  fusedScore: number
}

function reciprocalRank(rank: number): number {
  return 1 / (RECIPROCAL_RANK_FUSION_K + rank)
}

function isExhaustedResult(result: SearchResults): boolean {
  return (
    result.totalRelation !== "gte" &&
    result.next_cursor === undefined &&
    result.hits.length >= result.total
  )
}

function resolveCandidateDepth(
  configured: number | undefined,
  outputLimit: number | undefined,
): number {
  assertBoundedPositiveInteger(
    configured,
    "candidateDepthPerAudience",
    DEFAULT_FEDERATED_CANDIDATE_DEPTH,
  )
  assertBoundedPositiveInteger(outputLimit, "request.pagination.limit")
  return Math.max(configured ?? DEFAULT_FEDERATED_CANDIDATE_DEPTH, outputLimit ?? 0)
}

function assertBoundedPositiveInteger(
  value: number | undefined,
  name: string,
  fallback?: number,
): void {
  const resolved = value ?? fallback
  if (resolved === undefined) return
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved <= 0) {
    throw new RangeError(`${name} must be a positive finite integer; received ${String(resolved)}`)
  }
  if (resolved > MAX_FEDERATED_CANDIDATE_DEPTH) {
    throw new RangeError(`${name} may not exceed ${MAX_FEDERATED_CANDIDATE_DEPTH}`)
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
