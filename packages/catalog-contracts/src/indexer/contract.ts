/**
 * Engine-agnostic contract for the catalog plane's search index.
 *
 * Storefront documents are scoped per `(vertical, locale, audience, market,
 * channel)`. Admin documents denormalize text fields across audiences for
 * keyword matching while admin embeddings remain audience-scoped.
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
   * slices.
   */
  channel?: string
}

/** One document in the search index. */
export interface IndexerDocument {
  /** Document id, typically the entity id. */
  id: string
  /** Values keyed by field-policy path. */
  fields: Record<string, unknown>
  /** Optional embeddings keyed by their index field name. */
  embeddings?: Record<string, number[]>
  /** Embedding model identifier used to prevent mixed-model comparisons. */
  embedding_model_id?: string
}

/** Search query mode. */
export type SearchMode = "keyword" | "semantic" | "hybrid"

/** Portable storefront sort options. */
export type SearchSortOption = "relevance" | "price-asc" | "price-desc" | "departure-asc" | "newest"

/** Pagination shape. Cursors are opaque to callers. */
export interface SearchPagination {
  cursor?: string
  limit?: number
}

/**
 * Portable filter expression translated by each engine adapter. The reserved
 * `id` field addresses {@link IndexerDocument.id}; other fields address
 * {@link IndexerDocument.fields}.
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
  /** Free-text query. Empty string means match everything subject to filters. */
  query: string
  /** Optional caller-supplied query embedding. */
  query_embedding?: number[]
  /** Embedding model id for `query_embedding`. */
  query_embedding_model_id?: string
  mode: SearchMode
  sort?: SearchSortOption
  filters?: SearchFilter[]
  facets?: FacetRequest[]
  pagination?: SearchPagination
  /** Staff-only cross-audience federation. */
  search_audiences?: Visibility[]
  /** Hybrid rank-fusion weight in the inclusive range `0..1`. */
  alpha?: number
  /** Maximum cosine distance accepted for vector results. */
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

/** Features declared by an index engine implementation. */
export interface IndexerCapabilities {
  supportsKeywordSearch: boolean
  supportsHybridSearch: boolean
  supportsVectorFields: boolean
  /** Required vector dimension, or null when vector fields are unsupported. */
  vectorDimensions: number | null
  /** Engine vector count limit per document, or null when unlimited. */
  maxVectorsPerDocument: number | null
  supportsCrossAudienceFederation: boolean
  supportsAdminDenormalization: boolean
}

/** Engine-neutral inputs supplied by catalog runtime composition. */
export interface IndexerProviderOptions {
  registries: ReadonlyMap<string, FieldPolicyRegistry>
  /** Embedding dimension selected by the deployment, or null when disabled. */
  vectorDimensions?: number | null
}

/**
 * Deployment-owned factory for an index engine adapter. Provider setup may be
 * asynchronous, but request-runtime adapter construction is synchronous.
 */
export interface IndexerProvider {
  create(options: IndexerProviderOptions): IndexerAdapter
}

export interface IndexerScanOptions {
  /** Preferred provider page/batch size. Providers may enforce their own cap. */
  batchSize?: number
}

/**
 * Optional operational surface for deployment tooling. Keeping these methods
 * together prevents lifecycle and maintenance concerns from becoming required
 * search-adapter methods.
 */
export interface IndexerAdmin {
  /** List the slices currently managed by this adapter. */
  list(): Promise<IndexerSlice[]>
  /** Drop one slice. Returns false when it did not exist. */
  drop(slice: IndexerSlice): Promise<boolean>
  /** Stream every document in a slice without materializing the collection. */
  scan(slice: IndexerSlice, options?: IndexerScanOptions): AsyncIterable<IndexerDocument>
}

/**
 * One indexer implementation per deployment. Verticals push documents through
 * the adapter; storefront and admin search query through it.
 */
export interface IndexerAdapter {
  capabilities: IndexerCapabilities

  /** Optional lifecycle and maintenance operations for deployment tooling. */
  admin?: IndexerAdmin

  /** Set up or migrate the engine-side schema for one slice. */
  ensureCollection(slice: IndexerSlice, registry: FieldPolicyRegistry): Promise<void>

  /** Upsert one or more documents into a slice. */
  upsert(slice: IndexerSlice, documents: IndexerDocument[]): Promise<void>

  /** Delete documents from a slice by id. */
  delete(slice: IndexerSlice, ids: string[]): Promise<void>

  /** Search a slice with the portable request shape. */
  search(slice: IndexerSlice, request: SearchRequest): Promise<SearchResults>

  /** Bulk-index a stream of documents for cold starts and migrations. */
  bulkReindex(
    slice: IndexerSlice,
    stream: AsyncIterable<IndexerDocument>,
    options?: { forceReembed?: boolean },
  ): Promise<void>
}

/** Converts a vertical source row into an index document. */
export interface DocumentEmitter<TSource = unknown> {
  vertical: string
  emit(source: TSource, slice: IndexerSlice): IndexerDocument
}
