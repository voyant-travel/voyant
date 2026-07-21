import type {
  FacetRequest,
  IndexerAdapter,
  IndexerDocument,
  IndexerProviderOptions,
  IndexerScanOptions,
  IndexerSlice,
  SearchFilter,
  SearchHit,
  SearchRequest,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import {
  resolveFacetBucketLimit,
  resolveSearchSort,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { sql } from "drizzle-orm"

import type { FieldPolicyRegistry } from "../contract.js"

const MAX_CANDIDATES = 10_000
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 250
const DEFAULT_SCAN_BATCH_SIZE = 250
const MAX_SCAN_BATCH_SIZE = 1_000

type StoredRow = {
  id: string
  fields: Record<string, unknown> | string
  embeddings: Record<string, number[]> | string | null
  embedding_model_id: string | null
  document_text: string
}

export interface PostgresIndexerOptions extends IndexerProviderOptions {
  /** The deployment-owned pooled database client. */
  db: AnyDrizzleDb
}

/**
 * Native Postgres catalog search projection.
 *
 * This first slice deliberately uses only portable Postgres facilities: JSONB
 * storage for structural hit fidelity and a generated `tsvector` + GIN index
 * for bounded lexical retrieval. Lakebase BM25/ANN and pgvector strategies
 * build on the same projection in subsequent slices; they must be capability
 * selected rather than probed while serving a request.
 */
export function createPostgresIndexer(options: PostgresIndexerOptions): IndexerAdapter {
  const { db } = options

  const ensureStorage = async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS voyant_catalog_search_documents (
        vertical text NOT NULL,
        locale text NOT NULL,
        audience text NOT NULL,
        market text NOT NULL,
        channel text NOT NULL DEFAULT '',
        id text NOT NULL,
        fields jsonb NOT NULL,
        embeddings jsonb,
        embedding_model_id text,
        document_text text NOT NULL,
        search_vector tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', document_text)
        ) STORED,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (vertical, locale, audience, market, channel, id)
      )
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS voyant_catalog_search_documents_vector_idx
        ON voyant_catalog_search_documents USING gin (search_vector)
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS voyant_catalog_search_documents_slice_idx
        ON voyant_catalog_search_documents (vertical, locale, audience, market, channel, id)
    `)
  }

  return {
    capabilities: {
      supportsKeywordSearch: true,
      // Vector capability remains false until the pgvector/Lakebase strategy
      // is selected from recorded deployment capability state.
      supportsHybridSearch: false,
      supportsVectorFields: false,
      vectorDimensions: null,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: true,
      supportsAdminDenormalization: true,
    },

    admin: {
      async list() {
        await ensureStorage()
        const rows = readRows(
          await db.execute(sql`
            SELECT DISTINCT vertical, locale, audience, market, channel
            FROM voyant_catalog_search_documents
            ORDER BY vertical, locale, audience, market, channel
          `),
        ) as Array<IndexerSlice & { channel: string }>
        return rows.map((row) => ({
          vertical: row.vertical,
          locale: row.locale,
          audience: row.audience as IndexerSlice["audience"],
          market: row.market,
          ...(row.channel ? { channel: row.channel } : {}),
        }))
      },

      async drop(slice) {
        await ensureStorage()
        const result = await db.execute(sql`
          DELETE FROM voyant_catalog_search_documents
          WHERE ${slicePredicate(slice)}
          RETURNING id
        `)
        return readRows(result).length > 0
      },

      async *scan(slice, scanOptions: IndexerScanOptions = {}) {
        await ensureStorage()
        const batchSize = boundedBatchSize(scanOptions.batchSize)
        let afterId: string | undefined
        for (;;) {
          const rows = readRows(
            await db.execute(sql`
              SELECT id, fields, embeddings, embedding_model_id, document_text
              FROM voyant_catalog_search_documents
              WHERE ${slicePredicate(slice)}
                ${afterId ? sql`AND id > ${afterId}` : sql``}
              ORDER BY id
              LIMIT ${batchSize}
            `),
          ) as StoredRow[]
          if (rows.length === 0) return
          for (const row of rows) yield toDocument(row)
          afterId = rows.at(-1)?.id
        }
      },
    },

    async ensureCollection(_slice: IndexerSlice, _registry: FieldPolicyRegistry) {
      await ensureStorage()
    },

    async upsert(slice, documents) {
      if (documents.length === 0) return
      await ensureStorage()
      for (const document of documents) {
        await db.execute(sql`
          INSERT INTO voyant_catalog_search_documents (
            vertical, locale, audience, market, channel, id, fields, embeddings,
            embedding_model_id, document_text
          ) VALUES (
            ${slice.vertical}, ${slice.locale}, ${slice.audience}, ${slice.market},
            ${slice.channel ?? ""}, ${document.id}, ${JSON.stringify(document.fields)}::jsonb,
            ${document.embeddings ? JSON.stringify(document.embeddings) : null}::jsonb,
            ${document.embedding_model_id ?? null}, ${documentText(document.fields)}
          ) ON CONFLICT (vertical, locale, audience, market, channel, id)
          DO UPDATE SET
            fields = EXCLUDED.fields,
            embeddings = EXCLUDED.embeddings,
            embedding_model_id = EXCLUDED.embedding_model_id,
            document_text = EXCLUDED.document_text,
            updated_at = now()
        `)
      }
    },

    async delete(slice, ids) {
      if (ids.length === 0) return
      await ensureStorage()
      await db.execute(sql`
          DELETE FROM voyant_catalog_search_documents
          WHERE ${slicePredicate(slice)}
          AND id IN (
            ${sql.join(
              ids.map((id) => sql`${id}`),
              sql`, `,
            )}
          )
      `)
    },

    async search(slice, request) {
      if (request.mode !== "keyword") {
        throw new Error("Postgres catalog indexer semantic and hybrid strategies are not enabled.")
      }
      await ensureStorage()
      const query = request.query.trim()
      const audiences =
        request.search_audiences?.length && slice.audience === "staff-admin"
          ? request.search_audiences
          : [slice.audience]
      const rows = readRows(
        await db.execute(sql`
          SELECT id, fields, embeddings, embedding_model_id, document_text
          FROM voyant_catalog_search_documents
          WHERE ${slicePredicate(slice, audiences)}
            ${query ? sql`AND search_vector @@ websearch_to_tsquery('simple', ${query})` : sql``}
          ORDER BY id
          LIMIT ${MAX_CANDIDATES + 1}
        `),
      ) as StoredRow[]
      const capped = rows.length > MAX_CANDIDATES
      const candidates = (capped ? rows.slice(0, MAX_CANDIDATES) : rows)
        .map(toDocument)
        .filter((document) => matchesFilters(document, request.filters ?? []))
        .map((document) => ({ document, score: keywordScore(document, query) }))

      const ordered = orderHits(candidates, request, options.registries.get(slice.vertical), slice)
      const start = cursorOffset(ordered, request.pagination?.cursor)
      const limit = boundedPageSize(request.pagination?.limit)
      const page = ordered.slice(start, start + limit)
      const results: SearchResults = {
        hits: page,
        total: candidates.length,
        ...(capped ? { totalRelation: "gte" as const } : {}),
        ...(start + limit < ordered.length
          ? { next_cursor: encodeCursor(ordered[start + limit - 1]!) }
          : {}),
      }
      if (request.facets?.length) {
        results.facets = buildFacets(
          candidates.map(({ document }) => document),
          request.facets,
        )
      }
      return results
    },

    async bulkReindex(slice, stream) {
      let batch: IndexerDocument[] = []
      for await (const document of stream) {
        batch.push(document)
        if (batch.length === 100) {
          await this.upsert(slice, batch)
          batch = []
        }
      }
      await this.upsert(slice, batch)
    },
  }
}

function slicePredicate(slice: IndexerSlice, audiences: readonly string[] = [slice.audience]) {
  return sql`
    vertical = ${slice.vertical}
    AND locale = ${slice.locale}
    AND audience IN (
      ${sql.join(
        audiences.map((audience) => sql`${audience}`),
        sql`, `,
      )}
    )
    AND market = ${slice.market}
    AND channel = ${slice.channel ?? ""}
  `
}

function readRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows
  }
  return []
}

function toDocument(row: StoredRow): IndexerDocument {
  return {
    id: row.id,
    fields: parseJsonObject(row.fields),
    ...(row.embeddings
      ? { embeddings: parseJsonObject(row.embeddings) as Record<string, number[]> }
      : {}),
    ...(row.embedding_model_id ? { embedding_model_id: row.embedding_model_id } : {}),
  }
}

function parseJsonObject(value: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  }
  return value
}

function documentText(fields: Record<string, unknown>): string {
  return flattenValues(fields).join(" ")
}

function flattenValues(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)]
  }
  if (Array.isArray(value)) return value.flatMap(flattenValues)
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenValues)
  return []
}

function matchesFilters(document: IndexerDocument, filters: SearchFilter[]): boolean {
  return filters.every((filter) => matchesFilter(document, filter))
}

function matchesFilter(document: IndexerDocument, filter: SearchFilter): boolean {
  if (filter.kind === "and") {
    return filter.clauses.every((clause) => matchesFilter(document, clause))
  }
  if (filter.kind === "or") return filter.clauses.some((clause) => matchesFilter(document, clause))
  const value = filter.field === "id" ? document.id : document.fields[filter.field]
  if (filter.kind === "eq") return sameScalar(value, filter.value)
  if (filter.kind === "in") return filter.values.some((candidate) => sameScalar(value, candidate))
  return (
    typeof value === "number" &&
    (filter.gte === undefined || value >= filter.gte) &&
    (filter.lte === undefined || value <= filter.lte)
  )
}

function sameScalar(value: unknown, expected: string | number | boolean): boolean {
  if (Array.isArray(value)) return value.some((entry) => sameScalar(entry, expected))
  return value === expected
}

function keywordScore(document: IndexerDocument, query: string): number {
  if (!query) return 0
  const text = documentText(document.fields).toLocaleLowerCase()
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, token) => score + occurrences(text, token), 0)
}

function occurrences(text: string, token: string): number {
  let index = text.indexOf(token)
  let count = 0
  while (index !== -1) {
    count += 1
    index = text.indexOf(token, index + token.length)
  }
  return count
}

function orderHits(
  candidates: Array<{ document: IndexerDocument; score: number }>,
  request: SearchRequest,
  registry: FieldPolicyRegistry | undefined,
  slice: IndexerSlice,
): SearchHit[] {
  const hits: SearchHit[] = candidates.map(({ document, score }) => ({
    id: document.id,
    score,
    document,
  }))
  const sort = request.sort ?? "relevance"
  return hits.sort((left, right) => {
    if (sort === "relevance") return right.score - left.score || left.id.localeCompare(right.id)
    const resolved = registry ? resolveSearchSort(sort, registry, slice) : undefined
    const [field, direction] = resolved ? [resolved.field, resolved.direction] : sortField(sort)
    const comparison = compareSortValues(left.document.fields[field], right.document.fields[field])
    return (direction === "asc" ? comparison : -comparison) || left.id.localeCompare(right.id)
  })
}

function sortField(sort: NonNullable<SearchRequest["sort"]>): [string, "asc" | "desc"] {
  if (sort === "price-asc") return ["priceFromAmountCents", "asc"]
  if (sort === "price-desc") return ["priceFromAmountCents", "desc"]
  if (sort === "departure-asc") return ["nextDepartureDate", "asc"]
  return ["publishedAt", "desc"]
}

function compareSortValues(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === undefined || left === null) return 1
  if (right === undefined || right === null) return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right))
}

function buildFacets(documents: IndexerDocument[], facets: readonly FacetRequest[]) {
  return Object.fromEntries(
    facets.map((facet) => {
      const counts = new Map<string | number, number>()
      for (const document of documents) {
        const value = document.fields[facet.field]
        const values = Array.isArray(value) ? value : [value]
        for (const entry of values) {
          if (typeof entry !== "string" && typeof entry !== "number") continue
          counts.set(entry, (counts.get(entry) ?? 0) + 1)
        }
      }
      return [
        facet.field,
        [...counts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort(
            (left, right) =>
              right.count - left.count || String(left.value).localeCompare(String(right.value)),
          )
          .slice(0, resolveFacetBucketLimit(facet.limit)),
      ]
    }),
  )
}

function boundedPageSize(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_PAGE_SIZE
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
    throw new RangeError(
      `Search limit must be a positive finite integer; received ${String(limit)}`,
    )
  }
  return Math.min(limit, MAX_PAGE_SIZE)
}

function boundedBatchSize(batchSize: number | undefined): number {
  if (batchSize === undefined) return DEFAULT_SCAN_BATCH_SIZE
  if (!Number.isFinite(batchSize) || !Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError(
      `Scan batch size must be a positive finite integer; received ${String(batchSize)}`,
    )
  }
  return Math.min(batchSize, MAX_SCAN_BATCH_SIZE)
}

function encodeCursor(hit: SearchHit): string {
  return Buffer.from(JSON.stringify({ id: hit.id })).toString("base64url")
}

function cursorOffset(hits: SearchHit[], cursor: string | undefined): number {
  if (!cursor) return 0
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof (decoded as { id?: unknown }).id !== "string"
    ) {
      throw new Error("invalid")
    }
    const index = hits.findIndex((hit) => hit.id === (decoded as { id: string }).id)
    if (index < 0) throw new Error("invalid")
    return index + 1
  } catch {
    throw new RangeError("Search cursor is invalid.")
  }
}
