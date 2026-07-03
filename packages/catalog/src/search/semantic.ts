/**
 * Semantic / hybrid search orchestration.
 *
 * Wraps the Phase 1 `IndexerAdapter.search` with the embedding-generation
 * step. When `mode: "semantic" | "hybrid"`, this helper embeds the query
 * via the configured `EmbeddingProvider`, attaches the vector to the
 * `SearchRequest` as `query_embedding`, and delegates to the adapter.
 *
 * Callers that already have a query embedding (an upstream agent that
 * vectorized the user's intent) can skip embedding by passing
 * `query_embedding` directly — `executeSemanticSearch` honors a
 * caller-supplied vector and skips the embed call.
 *
 * See `docs/architecture/catalog-architecture.md` for the design.
 */

import type { EmbeddingProvider } from "../embeddings/contract.js"
import type {
  IndexerAdapter,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "../indexer/contract.js"

export interface SemanticSearchOptions {
  /** Adapter to query. */
  adapter: IndexerAdapter
  /**
   * Embedding provider — used to vectorize the query string when the mode
   * needs vectors. Optional: callers running pure-keyword searches can omit
   * this. `executeSemanticSearch` throws a clear error if mode is
   * `semantic` / `hybrid` and no provider is configured.
   */
  embeddings?: EmbeddingProvider
  /** The variant slice (vertical, locale, audience, market) to search. */
  slice: IndexerSlice
  /** The search request. `mode` controls keyword/hybrid/semantic blending. */
  request: SearchRequest
}

/**
 * Run a search request that may need a query embedding generated.
 *
 * Behavior by mode:
 *   - `keyword`   — adapter.search called directly; no embedding work.
 *   - `hybrid`    — query string is embedded (unless caller supplied
 *                   `query_embedding`), adapter blends keyword + vector
 *                   scores.
 *   - `semantic`  — query string is embedded, adapter does pure vector
 *                   similarity. (Engines that don't support pure-semantic
 *                   typically fall back to hybrid with the keyword weight
 *                   set very low.)
 *
 * Verifies adapter capabilities at runtime: requesting `semantic` /
 * `hybrid` against an adapter without `supportsVectorFields` throws
 * a clear error rather than silently degrading to keyword-only.
 */
export async function executeSemanticSearch(
  options: SemanticSearchOptions,
): Promise<SearchResults> {
  const { adapter, embeddings, slice, request } = options

  if (request.mode === "keyword") {
    return adapter.search(slice, request)
  }

  if (!adapter.capabilities.supportsVectorFields) {
    throw new Error(
      `Search mode "${request.mode}" requires an indexer that supports vector fields. ` +
        `Configured adapter does not declare supportsVectorFields. Use mode: "keyword" or swap to a vector-capable adapter (e.g. Typesense).`,
    )
  }

  if (request.mode === "hybrid" && !adapter.capabilities.supportsHybridSearch) {
    throw new Error(
      `Search mode "hybrid" requires an indexer that declares supportsHybridSearch. ` +
        `Configured adapter does not. Either use mode: "semantic" (pure vector) or swap to a hybrid-capable engine.`,
    )
  }

  // Use caller-supplied embedding if provided; otherwise generate one.
  let queryEmbedding = request.query_embedding
  if (!queryEmbedding && request.query.length > 0) {
    if (!embeddings) {
      throw new Error(
        `Search mode "${request.mode}" requires an EmbeddingProvider to vectorize the query. ` +
          `Configure one (e.g. createGeminiEmbeddingProvider) or supply request.query_embedding directly.`,
      )
    }
    const [vector] = await embeddings.embed([request.query])
    if (!vector) {
      throw new Error("EmbeddingProvider returned no vector for the query string")
    }
    queryEmbedding = vector
  }

  return adapter.search(slice, {
    ...request,
    query_embedding: queryEmbedding,
    query_embedding_model_id: request.query_embedding_model_id ?? embeddings?.capabilities.modelId,
  })
}

/**
 * Helper for callers (typically AI agents) that have already vectorized
 * a query upstream and want to bypass the embedding step entirely. The
 * vector is attached to the request as-is.
 */
export async function executeBYOVectorSearch(options: {
  adapter: IndexerAdapter
  slice: IndexerSlice
  request: SearchRequest & { query_embedding: number[] }
}): Promise<SearchResults> {
  const { adapter, slice, request } = options
  if (!adapter.capabilities.supportsVectorFields) {
    throw new Error(
      "BYO-vector search requires an indexer with supportsVectorFields. The configured adapter does not.",
    )
  }
  return adapter.search(slice, request)
}
