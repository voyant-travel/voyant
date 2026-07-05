// agent-quality: file-size exception -- owner: catalog; existing module stays co-located until a dedicated split preserves behavior and tests.
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
  SearchResults,
} from "./contract.js"
import {
  buildDefaultTypesenseQueryBy,
  buildDefaultTypesenseSearchFields,
  buildSearchQuery,
  isTypesenseSortableStringField,
  type TypesenseSearchQuery,
  typesenseTypeForField,
} from "./typesense-search-query.js"

export {
  buildDefaultTypesenseQueryBy,
  buildDefaultTypesenseSearchFields,
  buildSearchQuery,
  type TypesenseSearchQuery,
} from "./typesense-search-query.js"

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
  sort?: boolean
  num_dim?: number
  vec_dist?: "cosine" | "ip"
}

export interface TypesenseCollectionSchema {
  name: string
  fields: TypesenseFieldSchema[]
  default_sorting_field?: string
  enable_nested_fields?: boolean
  metadata?: Record<string, unknown>
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
// Bulk import result inspection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row's outcome from Typesense's `documents/import` endpoint. The endpoint
 * returns HTTP 200 even when individual rows fail validation; each line of the
 * response body is a JSON object of this shape. Failures are easy to miss —
 * the whole point of inspecting the body is to not let them pass silently
 * (a bad field shape can make *every* document fail while the CLI exits 0).
 */
export interface TypesenseImportRowResult {
  success: boolean
  error?: string
  /** The offending document, serialized by Typesense. */
  document?: string
  code?: number
}

/** Summary of the failed rows in one import response. */
export interface ImportFailureSummary {
  collection: string
  /** Number of rows that failed to import. */
  failed: number
  /** Total rows the response reported on. */
  total: number
  /** Up to `sampleSize` representative row errors. */
  samples: string[]
}

/** How the adapter reacts to row-level import failures. */
export type ImportFailureMode = "throw" | "best-effort"

/**
 * Raised when Typesense reports row-level import failures and the adapter is
 * in `"throw"` mode (the default). Carries the failure counts so a CLI can
 * exit non-zero and a caller can decide whether to retry.
 */
export class TypesenseImportError extends Error {
  readonly collection: string
  readonly failed: number
  readonly total: number
  readonly samples: string[]

  constructor(summary: ImportFailureSummary) {
    super(
      `Typesense import into "${summary.collection}" failed for ${summary.failed}/${summary.total} document(s): ${summary.samples.join("; ")}`,
    )
    this.name = "TypesenseImportError"
    this.collection = summary.collection
    this.failed = summary.failed
    this.total = summary.total
    this.samples = summary.samples
  }
}

function toImportRowResult(row: Record<string, unknown>): TypesenseImportRowResult {
  return {
    success: row.success === true,
    error: typeof row.error === "string" ? row.error : undefined,
    document: typeof row.document === "string" ? row.document : undefined,
    code: typeof row.code === "number" ? row.code : undefined,
  }
}

/**
 * Normalizes the `documents/import` response into per-row results. The fetch
 * client returns the raw newline-delimited JSON body (a `string`); the
 * official `typesense` SDK returns an already-parsed array of objects. Any
 * other shape (e.g. a `{}` test double, or `undefined`) yields `[]` — there
 * is nothing to inspect, so it is treated as "no reported failures".
 */
export function parseTypesenseImportResults(result: unknown): TypesenseImportRowResult[] {
  if (typeof result === "string") {
    const rows: TypesenseImportRowResult[] = []
    for (const line of result.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        rows.push(toImportRowResult(JSON.parse(trimmed) as Record<string, unknown>))
      } catch {
        // Typesense always returns valid JSONL; an unparseable line means
        // something is wrong, so surface it rather than hide it.
        rows.push({ success: false, error: `unparseable import response line: ${trimmed}` })
      }
    }
    return rows
  }
  if (Array.isArray(result)) {
    return result.map((row) =>
      row && typeof row === "object"
        ? toImportRowResult(row as Record<string, unknown>)
        : { success: false, error: "malformed import row" },
    )
  }
  return []
}

function formatImportRowError(row: TypesenseImportRowResult): string {
  const parts: string[] = []
  if (row.error) parts.push(row.error)
  if (row.document) {
    const doc = row.document.length > 200 ? `${row.document.slice(0, 200)}…` : row.document
    parts.push(`document=${doc}`)
  }
  return parts.length > 0 ? parts.join(" ") : "unknown import error"
}

/**
 * Inspects an import response and returns a failure summary, or `null` when
 * every reported row succeeded (or the response carried no inspectable rows).
 */
export function summarizeImportFailures(
  collection: string,
  result: unknown,
  sampleSize = 5,
): ImportFailureSummary | null {
  const rows = parseTypesenseImportResults(result)
  if (rows.length === 0) return null
  const failures = rows.filter((row) => !row.success)
  if (failures.length === 0) return null
  return {
    collection,
    failed: failures.length,
    total: rows.length,
    samples: failures.slice(0, sampleSize).map(formatImportRowError),
  }
}

function defaultImportFailureReporter(summary: ImportFailureSummary): void {
  const detail = summary.samples.length > 0 ? ` Sample errors: ${summary.samples.join("; ")}` : ""
  console.warn(
    `[catalog/typesense] ${summary.failed}/${summary.total} document(s) failed to import into "${summary.collection}".${detail}`,
  )
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
  /**
   * Field-policy registries keyed by vertical. Seeds the per-vertical registry
   * cache so a search-only process (the worker, which never runs
   * `ensureCollection`) builds queries against the REAL policy — including
   * numeric sort/filter fields. Without this, search falls back to
   * `inferRegistryFromCollection`, which only knows string fields, so numeric
   * sorts (e.g. `price-asc` → `priceFromAmountCents`) silently no-op.
   */
  registries?: ReadonlyMap<string, FieldPolicyRegistry>
  /**
   * How to treat row-level import failures. Typesense's bulk-import endpoint
   * returns HTTP 200 even when individual rows fail validation (e.g. a field
   * serialized as an object where the schema expects `string[]`), so a reindex
   * can silently leave a collection empty. Default `"throw"` raises a
   * {@link TypesenseImportError} so the reindex CLI exits non-zero; set
   * `"best-effort"` to log and keep going.
   */
  importFailureMode?: ImportFailureMode
  /**
   * Invoked with a summary whenever any row fails to import, regardless of
   * `importFailureMode` (in `"throw"` mode it fires just before the throw).
   * Defaults to a `console.warn`. Use to route failures to a structured logger.
   */
  onImportFailure?: (summary: ImportFailureSummary) => void
  /** Number of representative row errors included in summaries. Default 5. */
  importErrorSampleSize?: number
  /**
   * Retry delays for Typesense's transient collection-schema update lock.
   * Default is short exponential backoff; tests may pass zeroes.
   */
  collectionUpdateRetryDelaysMs?: readonly number[]
}

const DEFAULT_COLLECTION_UPDATE_RETRY_DELAYS_MS = [100, 250, 500, 1_000] as const

const TYPESENSE_CAPABILITIES: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: null, // overridden per-instance based on configured embedding provider
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: true,
  supportsAdminDenormalization: true,
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function isTransientCollectionUpdateError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    /another collection update operation is in progress/i.test(message) ||
    (/422/.test(message) && /collection update operation/i.test(message))
  )
}

async function retryTransientCollectionUpdate(
  operation: () => Promise<void>,
  delaysMs: readonly number[],
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await operation()
      return
    } catch (err) {
      if (!isTransientCollectionUpdateError(err) || attempt >= delaysMs.length) {
        throw err
      }
      const delayMs = delaysMs[attempt] ?? 0
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
}

/**
 * Returns the Typesense collection name for one variant slice. Stable across
 * runs so existing collections survive deployments.
 */
export function collectionName(slice: IndexerSlice, prefix = ""): string {
  const base = [slice.vertical, slice.locale, slice.audience, slice.market, slice.channel]
    .filter((part): part is string => Boolean(part))
    .join("__")
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
    fields.push({
      name: "embedding_model_id",
      type: "string",
      facet: true,
      optional: true,
    })
  }

  return {
    name: collectionName(slice, options.collectionPrefix),
    fields,
    enable_nested_fields: true,
    metadata: {
      voyant: {
        defaultQueryBy: buildDefaultTypesenseQueryBy(registry, slice),
        defaultSearchFields: buildDefaultTypesenseSearchFields(registry, slice),
      },
    },
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
    sort: type === "string" && isTypesenseSortableStringField(baseName) ? true : undefined,
  }
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
  //
  // Seeded from `options.registries` so a search-only process (the worker)
  // has the real policies without running `ensureCollection` — otherwise it
  // falls back to the string-only inferred registry and numeric sorts no-op.
  const registryByVertical = new Map<string, FieldPolicyRegistry>(options.registries)

  const importFailureMode = options.importFailureMode ?? "throw"
  const importErrorSampleSize = options.importErrorSampleSize ?? 5
  const reportImportFailure = options.onImportFailure ?? defaultImportFailureReporter
  const collectionUpdateRetryDelaysMs =
    options.collectionUpdateRetryDelaysMs ?? DEFAULT_COLLECTION_UPDATE_RETRY_DELAYS_MS

  // Inspect an import response for row-level failures. Typesense returns HTTP
  // 200 even when individual rows fail, so without this the index can silently
  // end up empty after a successful-looking reindex.
  const assertImportSucceeded = (collection: string, result: unknown): void => {
    const summary = summarizeImportFailures(collection, result, importErrorSampleSize)
    if (!summary) return
    reportImportFailure(summary)
    if (importFailureMode === "throw") {
      throw new TypesenseImportError(summary)
    }
  }

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
          (current.facet ?? false) !== (desired.facet ?? false) ||
          (current.sort ?? false) !== (desired.sort ?? false)
        ) {
          updates.push({ name: desired.name, type: desired.type, drop: true })
          updates.push(desired)
        }
      }
      const updatePayload: Partial<TypesenseCollectionSchema> = {
        metadata: schema.metadata,
      }
      if (updates.length > 0) {
        updatePayload.fields = updates as TypesenseFieldSchema[]
      }
      if (updates.length === 0 && sameJson(existing.metadata, schema.metadata)) {
        return
      }
      await retryTransientCollectionUpdate(
        () => client.collections(schema.name).update(updatePayload),
        collectionUpdateRetryDelaysMs,
      )
    },

    async upsert(slice, documents) {
      if (documents.length === 0) return
      const name = collectionName(slice, collectionPrefix)
      const payload = documents.map((d) => flattenDocument(d))
      const result = await client
        .collections(name)
        .documents()
        .import(payload, { action: "upsert" })
      assertImportSucceeded(name, result)
    },

    async delete(slice, ids) {
      if (ids.length === 0) return
      const name = collectionName(slice, collectionPrefix)
      const filterValue = ids.join(",")
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
      const query = buildSearchQuery(request, registry, slice)
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
        const result = await client
          .collections(name)
          .documents()
          .import(payload, { action: "upsert" })
        assertImportSucceeded(name, result)
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
