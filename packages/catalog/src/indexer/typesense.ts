/**
 * Native Typesense IndexerAdapter — the v1 default for catalog-plane search.
 *
 * Uses an injected `TypesenseClient` interface (mirroring the storage R2Bucket
 * binding pattern) so the package doesn't take a hard dep on the Typesense
 * HTTP SDK. Templates wire in the actual client.
 *
 * See `docs/architecture/catalog-architecture.md` §5.4.1 for design.
 */

import type { FieldPolicy, FieldPolicyRegistry } from "../contract.js"
import type {
  DocumentEmitter,
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchFilter,
  SearchRequest,
  SearchResults,
} from "./contract.js"

// ─────────────────────────────────────────────────────────────────────────────
// Injected client interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal interface the Typesense client must satisfy. Templates pass in
 * the real `typesense` SDK client (or a custom HTTP wrapper) and the adapter
 * uses only these methods.
 */
export interface TypesenseClient {
  collections(name?: string): {
    create(schema: TypesenseCollectionSchema): Promise<void>
    update(schema: Partial<TypesenseCollectionSchema>): Promise<void>
    delete(): Promise<void>
    retrieve(): Promise<TypesenseCollectionSchema>
    documents(): {
      import(documents: unknown[], options?: { action?: "upsert" | "create" }): Promise<unknown>
      delete(query: { filter_by: string }): Promise<unknown>
      search(query: TypesenseSearchQuery): Promise<TypesenseSearchResponse>
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typesense schema shapes (subset)
// ─────────────────────────────────────────────────────────────────────────────

export interface TypesenseFieldSchema {
  name: string
  type: "string" | "string[]" | "int32" | "int64" | "float" | "bool" | "object" | "float[]"
  facet?: boolean
  index?: boolean
  optional?: boolean
  num_dim?: number
  vec_dist?: "cosine" | "ip"
}

export interface TypesenseCollectionSchema {
  name: string
  fields: TypesenseFieldSchema[]
  default_sorting_field?: string
  enable_nested_fields?: boolean
}

export interface TypesenseSearchQuery {
  q: string
  query_by: string
  filter_by?: string
  facet_by?: string
  per_page?: number
  page?: number
  vector_query?: string
  prefix?: boolean
  exclude_fields?: string
  drop_tokens_threshold?: number
}

export interface TypesenseSearchHit {
  document: Record<string, unknown>
  text_match: number
}

export interface TypesenseSearchResponse {
  hits: TypesenseSearchHit[]
  found: number
  facet_counts?: Array<{
    field_name: string
    counts: Array<{ value: string | number; count: number }>
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export interface TypesenseIndexerOptions {
  client: TypesenseClient
  /** Embedding dimension shipped by the configured EmbeddingProvider. */
  vectorDimensions?: number | null
  /** Optional collection-name prefix (useful for multi-tenant single-cluster setups). */
  collectionPrefix?: string
}

const TYPESENSE_CAPABILITIES: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: null, // overridden per-instance based on configured embedding provider
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: true,
  supportsAdminDenormalization: true,
}

/**
 * Returns the Typesense collection name for one variant slice. Stable across
 * runs so existing collections survive deployments.
 */
export function collectionName(slice: IndexerSlice, prefix = ""): string {
  const base = `${slice.vertical}__${slice.locale}__${slice.audience}__${slice.market}`
  return prefix ? `${prefix}__${base}` : base
}

/**
 * Builds a Typesense collection schema from the field-policy registry. Maps
 * field-policy types onto Typesense field types using `query` + `class` from
 * the policy.
 */
export function buildCollectionSchema(
  slice: IndexerSlice,
  registry: FieldPolicyRegistry,
  options: { vectorDimensions?: number | null; collectionPrefix?: string } = {},
): TypesenseCollectionSchema {
  const fields: TypesenseFieldSchema[] = []

  for (const policy of registry.policies) {
    // Skip blob-only fields (stored but not indexed).
    if (policy.query === "blob-only") continue
    // Skip fields not visible to this slice's audience.
    if (slice.audience !== "staff-admin" && !policy.visibility.includes(slice.audience as never)) {
      continue
    }
    fields.push(typesenseFieldFromPolicy(policy))
  }

  // Vector field for embeddings (Phase 2). Only added if vectorDimensions is
  // configured.
  if (options.vectorDimensions != null) {
    fields.push({
      name: "text_embedding",
      type: "float[]",
      num_dim: options.vectorDimensions,
      vec_dist: "cosine",
      optional: true,
    })
  }

  return {
    name: collectionName(slice, options.collectionPrefix),
    fields,
    enable_nested_fields: true,
  }
}

function typesenseFieldFromPolicy(policy: FieldPolicy): TypesenseFieldSchema {
  const isFacet = policy.reindex === "facet-affecting" || policy.class === "structural"
  // Path-to-field-name: keep the dotted path; Typesense's nested fields handle it.
  const name = policy.path

  const isList = name.endsWith("[]")
  const baseName = isList ? name.slice(0, -2) : name
  const type = typesenseTypeForField(baseName, isList)

  return {
    name: baseName,
    type,
    facet: isFacet,
    optional: true,
  }
}

function typesenseTypeForField(name: string, isList: boolean): TypesenseFieldSchema["type"] {
  if (isList) return "string[]"
  if (BOOLEAN_FIELD_NAMES.has(name) || /^(has|is)[A-Z]/.test(name)) return "bool"
  if (FLOAT_FIELD_NAMES.has(name) || /(Latitude|Longitude)$/.test(name)) return "float"
  if (
    INTEGER_FIELD_NAMES.has(name) ||
    INTEGER_FIELD_SUFFIXES.some((suffix) => name.endsWith(suffix))
  ) {
    return "int64"
  }
  return "string"
}

/**
 * Translates the catalog plane's `SearchRequest` into a Typesense query.
 * Converts the filter expression tree, the audience-scoped query, and the
 * pagination shape.
 */
export function buildSearchQuery(
  request: SearchRequest,
  registry: FieldPolicyRegistry,
): TypesenseSearchQuery {
  // Build query_by from indexed text fields only. Typesense rejects numeric
  // and boolean fields in query_by even when those fields are filterable.
  const queryFields = registry.policies
    .filter(
      (p) =>
        p.query === "indexed-column" && (p.class === "merchandisable" || p.class === "structural"),
    )
    .map((p) => (p.path.endsWith("[]") ? p.path.slice(0, -2) : p.path))
    .filter((field) => isTextSearchableField(field))
    .join(",")

  const perPage = request.pagination?.limit ?? 20
  // Cursor doubles as the 1-indexed page number for Typesense's `page`
  // parameter. Callers wanting a different cursor strategy (e.g. opaque
  // cursor for streaming results) write a different adapter.
  const page = parsePageCursor(request.pagination?.cursor) ?? 1

  const query: TypesenseSearchQuery = {
    q: request.query.length > 0 ? request.query : "*",
    query_by: queryFields || "title",
    per_page: perPage,
    page,
    // Strip the vector field from response payloads — at e.g. 3072-dim that's
    // ~12 KB per hit of float-array noise the caller never reads. The catalog
    // plane re-resolves entities via `resolveEntity` for full views.
    exclude_fields: "text_embedding,embedding_model_id",
  }

  if (request.filters && request.filters.length > 0) {
    query.filter_by = serializeFilters(request.filters)
  }

  if (request.facets && request.facets.length > 0) {
    query.facet_by = request.facets.map((f) => f.field).join(",")
  }

  // Hybrid / semantic mode: attach the vector query if an embedding was
  // provided. The actual embedding generation for the query string lives in
  // the search/semantic helper (Phase 2); this adapter just relays it.
  if ((request.mode === "hybrid" || request.mode === "semantic") && request.query_embedding) {
    // Ground the ANN search against a candidate pool larger than `per_page`
    // so caller-side pagination has actual results to walk through. Typesense
    // resolves `max(k, per_page)` per the docs, so we lift the floor.
    const k = Math.max(perPage * 10, 100)
    const vectorOpts: string[] = [`k:${k}`]
    if (request.alpha != null) vectorOpts.push(`alpha:${request.alpha}`)
    if (request.distance_threshold != null) {
      vectorOpts.push(`distance_threshold:${request.distance_threshold}`)
    }
    query.vector_query = `text_embedding:([${request.query_embedding.join(",")}], ${vectorOpts.join(", ")})`
  }

  // For multi-token hybrid queries, the docs warn that the default
  // `drop_tokens_threshold` (10) leads to redundant internal keyword
  // re-runs. We disable token drop entirely — catalog queries tend to be
  // short and we'd rather return zero hits than spend CPU on permutations.
  if (request.mode === "hybrid" && request.query.length > 0) {
    query.drop_tokens_threshold = 0
  }

  return query
}

function parsePageCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const n = Number(cursor)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined
}

/**
 * Recognizes errors that originate from Typesense returning 404 when the
 * collection doesn't exist. The fetch-based template client throws Errors
 * whose message includes the status code; the official `typesense` SDK
 * throws an `ObjectNotFound` with `httpStatus === 404`. Match either.
 */
function isCollectionNotFoundError(err: unknown): boolean {
  if (!err) return false
  const status =
    typeof err === "object" && err !== null && "httpStatus" in err
      ? (err as { httpStatus?: unknown }).httpStatus
      : undefined
  if (status === 404) return true
  const message = err instanceof Error ? err.message : String(err)
  return / 404\b/.test(message) && /Not Found/i.test(message)
}

/**
 * Fallback used when `search()` is called before `ensureCollection()` has
 * cached a registry for this vertical. Fetches the live schema from
 * Typesense and synthesizes a minimal `FieldPolicyRegistry` whose policies
 * cover every string / string[] field as `merchandisable + indexed-column`.
 * That gives `buildSearchQuery` a non-empty `query_by` so the search
 * doesn't 404 on `query_by: "title"`.
 */
async function inferRegistryFromCollection(
  client: TypesenseClient,
  collectionName: string,
): Promise<FieldPolicyRegistry> {
  const schema = await client.collections(collectionName).retrieve()
  const policies: FieldPolicy[] = []
  for (const field of schema.fields) {
    if (field.type !== "string" && field.type !== "string[]") continue
    if (field.name === "id" || field.name === "text_embedding") continue
    policies.push({
      path: field.type === "string[]" ? `${field.name}[]` : field.name,
      class: "merchandisable",
      merge: "replace",
      drift: "low",
      reindex: "entry",
      snapshot: "never",
      query: "indexed-column",
      localized: false,
      visibility: ["staff", "customer", "partner", "supplier"],
      editRole: "marketing",
      overrideFriction: "none",
      sourceFreshness: "sync",
    })
  }
  const byPath = new Map(policies.map((p) => [p.path, p]))
  return {
    policies,
    byPath,
    resolve: (path: string) => byPath.get(path),
  }
}

function serializeFilters(filters: SearchFilter[]): string {
  return filters.map(serializeFilter).filter(Boolean).join(" && ")
}

function serializeFilter(filter: SearchFilter): string {
  switch (filter.kind) {
    case "eq":
      return `${filter.field}:=${typeof filter.value === "string" ? `"${filter.value}"` : filter.value}`
    case "in":
      return `${filter.field}:[${filter.values.map((v) => (typeof v === "string" ? `"${v}"` : v)).join(",")}]`
    case "range": {
      const parts: string[] = []
      if (filter.gte != null) parts.push(`${filter.field}:>=${filter.gte}`)
      if (filter.lte != null) parts.push(`${filter.field}:<=${filter.lte}`)
      return parts.join(" && ")
    }
    case "and":
      return filter.clauses.map(serializeFilter).join(" && ")
    case "or":
      return `(${filter.clauses.map(serializeFilter).join(" || ")})`
  }
}

export function createTypesenseIndexer(options: TypesenseIndexerOptions): IndexerAdapter {
  const { client, vectorDimensions = null, collectionPrefix = "" } = options
  const capabilities: IndexerCapabilities = {
    ...TYPESENSE_CAPABILITIES,
    vectorDimensions,
    supportsVectorFields: vectorDimensions != null,
    supportsHybridSearch: vectorDimensions != null,
  }

  // Cache the registry per vertical at `ensureCollection` time so `search`
  // can build a correct `query_by` against actual schema fields. Without
  // this, search falls back to `query_by: "title"` and Typesense returns
  // 404 because the products schema has no `title` field.
  const registryByVertical = new Map<string, FieldPolicyRegistry>()

  return {
    capabilities,

    async ensureCollection(slice, registry) {
      registryByVertical.set(slice.vertical, registry)
      const schema = buildCollectionSchema(slice, registry, {
        vectorDimensions,
        collectionPrefix,
      })
      // Typesense maintains `id` implicitly as the document primary key;
      // it must not appear in the schema fields list (the server rejects
      // alters to it with `Field "id" cannot be altered.`). Strip it
      // unconditionally — if a vertical's field policy declares `id`,
      // it's covered by the implicit doc id at index time.
      const fieldsForServer = schema.fields.filter((f) => f.name !== "id")
      const schemaForCreate: TypesenseCollectionSchema = {
        ...schema,
        fields: fieldsForServer,
      }

      try {
        await client.collections().create(schemaForCreate)
        return
      } catch {
        // Collection already exists — fall through to the update path.
      }

      // Typesense's `update` only accepts new fields, drops, and
      // drop+add as the way to "alter" an existing field. Diff existing
      // vs desired and emit:
      //   - additions for fields that don't exist yet
      //   - drop+add pairs for fields whose facet/type drifted (so a
      //     policy change like reindex:"entry" → "facet-affecting" gets
      //     picked up without operators having to nuke the collection)
      let existing: TypesenseCollectionSchema | undefined
      try {
        existing = await client.collections(schema.name).retrieve()
      } catch {
        // If retrieve also fails, surface the original create error path
        // by re-trying create — the second create will throw the real cause.
        await client.collections().create(schemaForCreate)
        return
      }
      const existingByName = new Map(existing.fields.map((f) => [f.name, f]))
      const updates: Array<TypesenseFieldSchema & { drop?: boolean }> = []
      for (const desired of fieldsForServer) {
        const current = existingByName.get(desired.name)
        if (!current) {
          updates.push(desired)
          continue
        }
        if (
          current.type !== desired.type ||
          (current.facet ?? false) !== (desired.facet ?? false)
        ) {
          updates.push({ name: desired.name, type: desired.type, drop: true })
          updates.push(desired)
        }
      }
      if (updates.length === 0) return
      await client.collections(schema.name).update({ fields: updates as TypesenseFieldSchema[] })
    },

    async upsert(slice, documents) {
      if (documents.length === 0) return
      const name = collectionName(slice, collectionPrefix)
      const payload = documents.map((d) => flattenDocument(d))
      await client.collections(name).documents().import(payload, { action: "upsert" })
    },

    async delete(slice, ids) {
      if (ids.length === 0) return
      const name = collectionName(slice, collectionPrefix)
      const filterValue = ids.map((id) => `"${id}"`).join(",")
      await client
        .collections(name)
        .documents()
        .delete({ filter_by: `id:[${filterValue}]` })
    },

    async search(slice, request) {
      const name = collectionName(slice, collectionPrefix)
      // Use the registry cached at ensureCollection() time so query_by
      // points at fields that actually exist in the schema. If a caller
      // searches before ensureCollection has run for this vertical, fall
      // back to fetching the live schema and inferring string-typed
      // fields — slower but at least produces a valid query.
      let registry: FieldPolicyRegistry | undefined = registryByVertical.get(slice.vertical)
      if (!registry) {
        try {
          registry = await inferRegistryFromCollection(client, name)
        } catch (err) {
          // Collection doesn't exist (vertical not indexed yet) — return
          // empty results instead of propagating a 404. Surfacing search
          // errors for unindexed verticals is hostile UX; downstream UI
          // already renders "no results" cleanly.
          if (isCollectionNotFoundError(err)) {
            return { hits: [], total: 0, facets: {} }
          }
          throw err
        }
      }
      const query = buildSearchQuery(request, registry)
      try {
        const response = await client.collections(name).documents().search(query)
        return mapTypesenseResponse(response)
      } catch (err) {
        if (isCollectionNotFoundError(err)) {
          return { hits: [], total: 0, facets: {} }
        }
        throw err
      }
    },

    async bulkReindex(slice, stream, _options) {
      const name = collectionName(slice, collectionPrefix)
      const batch: IndexerDocument[] = []
      const flush = async () => {
        if (batch.length === 0) return
        const payload = batch.map((d) => flattenDocument(d))
        await client.collections(name).documents().import(payload, { action: "upsert" })
        batch.length = 0
      }
      for await (const document of stream) {
        batch.push(document)
        if (batch.length >= 200) {
          await flush()
        }
      }
      await flush()
    },
  }
}

function flattenDocument(document: IndexerDocument): Record<string, unknown> {
  const flat: Record<string, unknown> = { id: document.id }
  for (const [path, value] of Object.entries(document.fields)) {
    flat[path] = coerceForTypesense(path, value)
  }
  if (document.embeddings) {
    for (const [name, vector] of Object.entries(document.embeddings)) {
      flat[name] = vector
    }
  }
  if (document.embedding_model_id) {
    flat.embedding_model_id = document.embedding_model_id
  }
  return flat
}

/**
 * Coerce a field value to match the Typesense schema inferred from the
 * policy path. `null`/`undefined` drop out because optional fields tolerate
 * absence. Arrays recurse element-wise.
 */
function coerceForTypesense(path: string, value: unknown): unknown {
  if (value == null) return undefined
  if (Array.isArray(value)) {
    const coerced = value.map((v) => coerceForTypesense(path, v)).filter((v) => v !== undefined)
    return coerced
  }
  const type = typesenseTypeForField(path, false)
  if (type === "bool") return coerceBool(value)
  if (type === "float") return coerceNumber(value)
  if (type === "int32" || type === "int64") return coerceInteger(value)
  if (typeof value === "string") return value
  if (typeof value === "object") {
    // Nested objects round-trip via JSON. Typesense's nested-fields support
    // accepts these only when the schema declares them as `object`/`object[]`,
    // which the policy registry does not currently emit. Stringify so the
    // payload at least lands; downstream consumers can JSON.parse.
    return JSON.stringify(value)
  }
  return String(value)
}

function isTextSearchableField(name: string): boolean {
  const type = typesenseTypeForField(name, false)
  return type === "string" || type === "string[]"
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function coerceInteger(value: unknown): number | undefined {
  const parsed = coerceNumber(value)
  if (parsed === undefined) return undefined
  return Math.trunc(parsed)
}

function coerceBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }
  return undefined
}

const BOOLEAN_FIELD_NAMES = new Set(["activated"])

const FLOAT_FIELD_NAMES = new Set(["latitude", "longitude"])

const INTEGER_FIELD_NAMES = new Set(["pax"])

const INTEGER_FIELD_SUFFIXES = [
  "AmountCents",
  "Percent",
  "Count",
  "Days",
  "EpochDays",
  "EpochMs",
  "Minutes",
  "Total",
]

function mapTypesenseResponse(response: TypesenseSearchResponse): SearchResults {
  const hits = response.hits.map((hit) => ({
    id: String(hit.document.id ?? ""),
    // Wildcard queries (`q=*`) and pure-vector searches don't compute a
    // `text_match` score — fall back to 0 so downstream consumers always
    // see a number.
    score: hit.text_match ?? 0,
    document: {
      id: String(hit.document.id ?? ""),
      fields: hit.document,
    } satisfies IndexerDocument,
  }))
  const facets: Record<string, Array<{ value: string | number; count: number }>> | undefined =
    response.facet_counts
      ? Object.fromEntries(response.facet_counts.map((f) => [f.field_name, f.counts]))
      : undefined
  return {
    hits,
    total: response.found,
    facets,
  }
}

/**
 * Helper for verticals that want to register a `DocumentEmitter` against
 * this adapter. Currently a thin pass-through; reserved for future emitter
 * registry extensions.
 */
export function attachEmitter<TSource>(
  emitter: DocumentEmitter<TSource>,
): DocumentEmitter<TSource> {
  return emitter
}
