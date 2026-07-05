/**
 * IndexerAdapter contract — engine-agnostic interface for the catalog plane's
 * search index.
 *
 * Voyant ships native Typesense as the v1 default (see `./typesense.ts`).
 * Deployments that prefer Algolia, Meilisearch, Postgres FTS, Elasticsearch,
 * or any other engine substitute their own implementation by satisfying this
 * contract.
 *
 * Storefront-side documents are scoped per `(vertical, locale, audience,
 * market, channel)`. Admin-side documents denormalize text fields across
 * audiences for keyword matching (see §5.4.4); admin embedding remains
 * audience-scoped.
 *
 * See `docs/architecture/catalog-architecture.md` §5.4 for the full design.
 */

import type { FieldPolicyRegistry, Visibility } from "../contract.js"

/** Identifies a single variant slice of an indexer collection. */
export interface IndexerSlice {
  vertical: string
  locale: string
  audience: Visibility | "staff-admin"
  market: string
  /**
   * Sales surface / distribution channel id. Omitted only for legacy/default
   * slices; channel-aware storefronts should set this explicitly so website,
   * B2B, OTA, and partner surfaces do not share one customer corpus.
   */
  channel?: string
}

/**
 * One document in the search index. Carries structured fields, optional
 * vector(s), and identity for upsert / delete.
 */
export interface IndexerDocument {
  /** Document id — typically the entity id (entity_module + entity_id pair). */
  id: string
  /** Field-keyed values. The shape matches the field-policy registry's
   *  indexed paths; engines store, index, and facet per their schema config. */
  fields: Record<string, unknown>
  /**
   * Optional embedding(s) keyed by name. Phase 1 ships keyword + hybrid only;
   * Semantic catalog indexing populates this for vector and hybrid retrieval.
   */
  embeddings?: Record<string, number[]>
  /**
   * Optional embedding model identifier. When present, the indexer scopes
   * vector queries to documents using a compatible model. See
   * the catalog semantic-search design.
   */
  embedding_model_id?: string
}

/** Search query mode. Phase 1 ships keyword + hybrid; semantic is Phase 2. */
export type SearchMode = "keyword" | "semantic" | "hybrid"

/**
 * Storefront-safe sort options. Adapters translate these to engine fields
 * that are present in the indexed slice instead of exposing raw field names.
 */
export type SearchSortOption = "relevance" | "price-asc" | "price-desc" | "departure-asc" | "newest"

/** Pagination shape. Cursor-based by default; page/offset is engine-dependent. */
export interface SearchPagination {
  cursor?: string
  limit?: number
}

/**
 * Filter expression. Engines translate this into their own filter DSL. Kept
 * intentionally narrow — facet equality, range, set membership — so the
 * contract works against any engine.
 */
export type SearchFilter =
  | { kind: "eq"; field: string; value: string | number | boolean }
  | { kind: "in"; field: string; values: ReadonlyArray<string | number> }
  | { kind: "range"; field: string; gte?: number; lte?: number }
  | { kind: "and"; clauses: SearchFilter[] }
  | { kind: "or"; clauses: SearchFilter[] }

/** A single facet aggregation request. */
export interface FacetRequest {
  field: string
  /** Maximum bucket count returned. */
  limit?: number
}

export interface SearchRequest {
  /** Free-text query. Empty string is "match everything subject to filters". */
  query: string
  /** Optional caller-supplied query embedding (BYO vector). */
  query_embedding?: number[]
  /** Embedding model id for `query_embedding`; adapters use this to avoid mixed-model vector comparisons. */
  query_embedding_model_id?: string
  mode: SearchMode
  sort?: SearchSortOption
  filters?: SearchFilter[]
  facets?: FacetRequest[]
  pagination?: SearchPagination
  /**
   * Cross-audience federation — Phase 2 only. Staff actors may request
   * results from a non-staff audience pool via this field. Customer / partner
   * / supplier agents are pinned to their own audience by API authorization.
   */
  search_audiences?: Visibility[]
  /**
   * Hybrid-mode rank-fusion weight. `0..1` — `0` is keyword-only, `1` is
   * semantic-only. Engine default mid-point varies (Typesense weights
   * keyword `0.7` / semantic `0.3`). Only meaningful when `mode` is
   * `hybrid` or when both signals participate.
   */
  alpha?: number
  /**
   * Drop hits whose vector distance exceeds this threshold (cosine
   * distance, range `0..2`). Useful in semantic mode to cut weak-similarity
   * tail results. Ignored in keyword-only mode.
   */
  distance_threshold?: number
}

export interface SearchHit {
  id: string
  score: number
  document: IndexerDocument
}

export interface SearchFacetBucket {
  value: string | number
  count: number
}

export interface SearchResults {
  hits: SearchHit[]
  total: number
  next_cursor?: string
  facets?: Record<string, SearchFacetBucket[]>
}

/**
 * Capabilities declared by the engine. Lets the catalog plane fail fast on
 * unsupported features rather than producing wrong results silently.
 *
 * Phase 1 deployments leave the `supports*Vector*` flags at `false` and
 * `vectorDimensions` at `null`; Phase 2 deployments fill them in.
 */
export interface IndexerCapabilities {
  /** Phase 1: keyword + hybrid keyword search. */
  supportsKeywordSearch: boolean
  /** Phase 1+: blend keyword and vector scores in one query (when vectors land). */
  supportsHybridSearch: boolean
  /** Phase 2: store and query vector fields. */
  supportsVectorFields: boolean
  /** Required vector dimension for embedding compatibility, or null if unsupported. */
  vectorDimensions: number | null
  /** Some engines cap vectors per document; null means unlimited. */
  maxVectorsPerDocument: number | null
  /**
   * Whether the engine can federate queries across multiple audience pools
   * (collections / shards) and deduplicate by entity ID. Used by the
   * cross-audience semantic-search pattern.
   */
  supportsCrossAudienceFederation: boolean
  /**
   * Whether the engine efficiently supports admin documents with multiple
   * weighted text fields (denormalized across audiences for keyword search,
   * see §5.4.4). Engines without efficient multi-field weighted search can
   * fall back to a flat concatenated text field with reduced expressiveness.
   */
  supportsAdminDenormalization: boolean
}

/**
 * The IndexerAdapter contract. One implementation per deployment (Typesense
 * default). Verticals push documents through the indexer; storefronts and
 * admin search query through it.
 */
export interface IndexerAdapter {
  capabilities: IndexerCapabilities

  /**
   * Set up or migrate the engine-side schema for one variant slice. Called
   * at deployment startup or when the field-policy registry changes shape.
   */
  ensureCollection(slice: IndexerSlice, registry: FieldPolicyRegistry): Promise<void>

  /** Upsert one or more documents into a slice. */
  upsert(slice: IndexerSlice, documents: IndexerDocument[]): Promise<void>

  /** Delete documents from a slice by id. */
  delete(slice: IndexerSlice, ids: string[]): Promise<void>

  /** Search a slice with the standard request shape. */
  search(slice: IndexerSlice, request: SearchRequest): Promise<SearchResults>

  /**
   * Cold-start / migration: bulk-reindex an entire slice from a stream of
   * documents. Engines may parallelize internally.
   */
  bulkReindex(
    slice: IndexerSlice,
    stream: AsyncIterable<IndexerDocument>,
    options?: { forceReembed?: boolean },
  ): Promise<void>
}

/**
 * Per-vertical document emitter — translates a vertical's resolved-view
 * source rows into `IndexerDocument` shapes. Each vertical implements its
 * own emitter; the catalog plane calls them at index time.
 */
export interface DocumentEmitter<TSource = unknown> {
  /** The vertical this emitter handles (matches `entity_module`). */
  vertical: string
  /** Convert a single source row into an indexer document. */
  emit(source: TSource, slice: IndexerSlice): IndexerDocument
}
