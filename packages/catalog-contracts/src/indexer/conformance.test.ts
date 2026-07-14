import { describe, expect, it } from "vitest"

import { assertIndexerAdapterConformance } from "./conformance.js"
import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchFilter,
  SearchRequest,
  SearchResults,
} from "./contract.js"

describe("assertIndexerAdapterConformance", () => {
  it("accepts an adapter with portable search and admin behavior", async () => {
    await expect(
      assertIndexerAdapterConformance({
        createAdapter: createMemoryIndexer,
        namespace: "memory-conformance",
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
    hits: page.map((document) => ({ id: document.id, score: 1, document })),
    total,
    next_cursor: nextOffset < total ? String(nextOffset) : undefined,
    facets,
  }
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
