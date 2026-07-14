import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry } from "../contract.js"
import { assertIndexerAdapterConformance, createIndexerConformanceRegistry } from "./conformance.js"
import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchFilter,
  SearchRequest,
  SearchResults,
} from "./contract.js"
import { resolveSearchSort, SEARCH_SORT_SEMANTICS } from "./contract.js"

describe("portable search sort semantics", () => {
  it("publishes stable field precedence and resolves the first policy-backed candidate", () => {
    const registry = createIndexerConformanceRegistry()

    expect(SEARCH_SORT_SEMANTICS["price-desc"]).toEqual({
      fieldCandidates: ["priceFromAmountCents", "sellAmountCents"],
      direction: "desc",
    })
    expect(resolveSearchSort("price-desc", registry)).toEqual({
      field: "priceFromAmountCents",
      direction: "desc",
    })
    expect(resolveSearchSort("relevance", registry)).toBeUndefined()
    expect(resolveSearchSort("newest", registry)).toBeUndefined()
  })

  it("skips blob-only candidates and resolves the next indexed policy", () => {
    const base = createIndexerConformanceRegistry()
    const pricePolicy = base.resolve("priceFromAmountCents")!
    const registry = createFieldPolicyRegistry([
      ...base.policies.map((policy) =>
        policy.path === pricePolicy.path ? { ...policy, query: "blob-only" as const } : policy,
      ),
      { ...pricePolicy, path: "sellAmountCents" },
    ])

    expect(resolveSearchSort("price-asc", registry)).toEqual({
      field: "sellAmountCents",
      direction: "asc",
    })
  })
})

describe("assertIndexerAdapterConformance", () => {
  it("accepts an adapter with portable search and admin behavior", async () => {
    await expect(
      assertIndexerAdapterConformance({
        createAdapter: createMemoryIndexer,
        namespace: "memory-conformance",
      }),
    ).resolves.toBeUndefined()
  })

  it("exercises every optional capability an adapter declares", async () => {
    await expect(
      assertIndexerAdapterConformance({
        createAdapter: () =>
          createMemoryIndexer({
            supportsHybridSearch: true,
            supportsVectorFields: true,
            vectorDimensions: 3,
            supportsCrossAudienceFederation: true,
            supportsAdminDenormalization: true,
          }),
        namespace: "memory-capabilities",
      }),
    ).resolves.toBeUndefined()
  })

  it("rejects dishonest vector capabilities before creating collections", async () => {
    const adapter = createMemoryIndexer({
      supportsVectorFields: false,
      vectorDimensions: 3,
    })

    await expect(assertIndexerAdapterConformance({ createAdapter: () => adapter })).rejects.toThrow(
      "vectorDimensions must be null when vector fields are unsupported",
    )
  })

  it("rejects an adapter that claims keyword support but ignores the query", async () => {
    const adapter = createMemoryIndexer()
    const search = adapter.search.bind(adapter)
    adapter.search = (slice, request) => search(slice, { ...request, query: "" })

    await expect(assertIndexerAdapterConformance({ createAdapter: () => adapter })).rejects.toThrow(
      "non-empty keyword search returned",
    )
  })

  it("rejects an adapter that ignores the requested sort order", async () => {
    const adapter = createMemoryIndexer()
    const search = adapter.search.bind(adapter)
    adapter.search = (slice, request) => search(slice, { ...request, sort: undefined })

    await expect(assertIndexerAdapterConformance({ createAdapter: () => adapter })).rejects.toThrow(
      "first page returned",
    )
  })

  it("requires vector fixtures to round-trip through admin scan", async () => {
    const adapter = createMemoryIndexer({
      supportsVectorFields: true,
      vectorDimensions: 3,
    })
    const admin = adapter.admin!
    const scan = admin.scan.bind(admin)
    admin.scan = async function* (slice, options) {
      for await (const document of scan(slice, options)) {
        yield { id: document.id, fields: document.fields }
      }
    }

    await expect(assertIndexerAdapterConformance({ createAdapter: () => adapter })).rejects.toThrow(
      "admin scan did not preserve the document embedding",
    )
  })

  it("rejects vector limits when vector fields are unsupported", async () => {
    const adapter = createMemoryIndexer({ maxVectorsPerDocument: 1 })

    await expect(assertIndexerAdapterConformance({ createAdapter: () => adapter })).rejects.toThrow(
      "maxVectorsPerDocument must be null when vector fields are unsupported",
    )
  })
})

interface MemoryCollection {
  slice: IndexerSlice
  documents: Map<string, IndexerDocument>
}

function createMemoryIndexer(
  capabilityOverrides: Partial<IndexerCapabilities> = {},
): IndexerAdapter {
  const collections = new Map<string, MemoryCollection>()
  const collection = (slice: IndexerSlice): MemoryCollection => {
    const found = collections.get(sliceKey(slice))
    if (!found) throw new Error(`Missing collection ${sliceKey(slice)}`)
    return found
  }

  const adapter: IndexerAdapter = {
    capabilities: {
      supportsKeywordSearch: true,
      supportsHybridSearch: false,
      supportsVectorFields: false,
      vectorDimensions: null,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: false,
      supportsAdminDenormalization: true,
      ...capabilityOverrides,
    },
    admin: {
      async list() {
        return [...collections.values()].map(({ slice }) => ({ ...slice }))
      },
      async drop(slice) {
        return collections.delete(sliceKey(slice))
      },
      async *scan(slice) {
        yield* collection(slice).documents.values()
      },
    },
    async ensureCollection(slice) {
      const key = sliceKey(slice)
      if (!collections.has(key)) collections.set(key, { slice, documents: new Map() })
    },
    async upsert(slice, documents) {
      const target = collection(slice).documents
      for (const document of documents) target.set(document.id, document)
    },
    async delete(slice, ids) {
      const target = collection(slice).documents
      for (const id of ids) target.delete(id)
    },
    async search(slice, request) {
      if (request.search_audiences && request.search_audiences.length > 0) {
        const federated = request.search_audiences.flatMap((audience) => {
          const target = collection({ ...slice, audience })
          return searchMemoryCollection(target, { ...request, search_audiences: undefined }).hits
        })
        const byId = new Map(federated.map((hit) => [hit.id, hit]))
        const hits = [...byId.values()].slice(0, request.pagination?.limit ?? byId.size)
        return { hits, total: byId.size }
      }
      return searchMemoryCollection(collection(slice), request)
    },
    async bulkReindex(slice, stream) {
      for await (const document of stream) {
        collection(slice).documents.set(document.id, document)
      }
    },
  }

  return adapter
}

function searchMemoryCollection(
  collection: MemoryCollection,
  request: SearchRequest,
): SearchResults {
  let documents = [...collection.documents.values()].filter((document) =>
    (request.filters ?? []).every((filter) => matchesFilter(document, filter)),
  )
  const scores = new Map<string, number>()

  const keyword = request.query.trim().toLocaleLowerCase()
  if (request.mode === "keyword") {
    if (keyword) documents = documents.filter((document) => matchesKeyword(document, keyword))
  } else if (request.query_embedding) {
    documents = documents.filter((document) => document.embeddings?.text_embedding)
    for (const document of documents) {
      const vectorScore = normalizedCosineSimilarity(
        request.query_embedding,
        document.embeddings!.text_embedding!,
      )
      const keywordScore = keyword && matchesKeyword(document, keyword) ? 1 : 0
      const score =
        request.mode === "semantic"
          ? vectorScore
          : (request.alpha ?? 0.3) * vectorScore + (1 - (request.alpha ?? 0.3)) * keywordScore
      scores.set(document.id, score)
    }
    documents.sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0))
  }

  if (request.sort === "price-asc" || request.sort === "price-desc") {
    const direction = request.sort === "price-asc" ? 1 : -1
    documents = documents.sort(
      (left, right) =>
        direction *
        (Number(left.fields.priceFromAmountCents) - Number(right.fields.priceFromAmountCents)),
    )
  }

  const facets = request.facets
    ? Object.fromEntries(
        request.facets.map(({ field, limit }) => {
          const counts = new Map<string | number, number>()
          for (const document of documents) {
            const value = fieldValue(document, field)
            const values = Array.isArray(value) ? value : [value]
            for (const item of values) {
              if (typeof item !== "string" && typeof item !== "number") continue
              counts.set(item, (counts.get(item) ?? 0) + 1)
            }
          }
          return [
            field,
            [...counts.entries()]
              .map(([value, count]) => ({ value, count }))
              .sort(
                (left, right) =>
                  right.count - left.count || String(left.value).localeCompare(String(right.value)),
              )
              .slice(0, limit ?? counts.size),
          ]
        }),
      )
    : undefined

  const total = documents.length
  const offset = Number(request.pagination?.cursor ?? 0)
  const limit = request.pagination?.limit ?? 20
  const page = documents.slice(offset, offset + limit)
  const nextOffset = offset + page.length

  return {
    hits: page.map((document) => ({
      id: document.id,
      score: scores.get(document.id) ?? 1,
      document,
    })),
    total,
    next_cursor: nextOffset < total ? String(nextOffset) : undefined,
    facets,
  }
}

function matchesKeyword(document: IndexerDocument, keyword: string): boolean {
  return Object.values(document.fields).some((value) =>
    (Array.isArray(value) ? value : [value]).some(
      (item) => typeof item === "string" && item.toLocaleLowerCase().includes(keyword),
    ),
  )
}

function normalizedCosineSimilarity(left: number[], right: number[]): number {
  const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
  const leftMagnitude = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0))
  const rightMagnitude = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0))
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0
  return (dot / (leftMagnitude * rightMagnitude) + 1) / 2
}

function matchesFilter(document: IndexerDocument, filter: SearchFilter): boolean {
  switch (filter.kind) {
    case "eq": {
      const value = fieldValue(document, filter.field)
      return Array.isArray(value) ? value.includes(filter.value) : value === filter.value
    }
    case "in": {
      const value = fieldValue(document, filter.field)
      return Array.isArray(value)
        ? value.some((item) => filter.values.includes(item as string | number))
        : filter.values.includes(value as string | number)
    }
    case "range": {
      const value = Number(fieldValue(document, filter.field))
      return (
        (filter.gte === undefined || value >= filter.gte) &&
        (filter.lte === undefined || value <= filter.lte)
      )
    }
    case "and":
      return filter.clauses.every((clause) => matchesFilter(document, clause))
    case "or":
      return filter.clauses.some((clause) => matchesFilter(document, clause))
  }
}

function fieldValue(document: IndexerDocument, field: string): unknown {
  const normalized = field.endsWith("[]") ? field.slice(0, -2) : field
  if (normalized === "id") return document.id
  return document.fields[normalized]
}

function sliceKey(slice: IndexerSlice): string {
  return [slice.vertical, slice.locale, slice.audience, slice.market, slice.channel ?? ""].join("|")
}
