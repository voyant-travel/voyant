import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import type { IndexerDocument, IndexerSlice } from "./contract.js"
import {
  buildCollectionSchema,
  buildDefaultTypesenseQueryBy,
  buildDefaultTypesenseSearchFields,
  buildSearchQuery,
  createTypesenseIndexer,
  type ImportFailureSummary,
  parseTypesenseImportResults,
  summarizeImportFailures,
  type TypesenseClient,
  TypesenseImportError,
} from "./typesense.js"

const slice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

const registry = createFieldPolicyRegistry(
  defineFieldPolicy([
    {
      path: "name",
      class: "merchandisable",
      merge: "replace",
      editRole: "marketing",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "priceFromAmountCents",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "nextDepartureAt",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "nextDepartureDate",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "createdAt",
      class: "managed",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["staff"],
    },
    {
      path: "durationDays",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "latitude",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "hasOffer",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "categorySlugs[]",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "thumbnailUrl",
      class: "merchandisable",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["customer"],
    },
    {
      path: "status",
      class: "structural",
      merge: "source-only",
      editRole: "none",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["staff"],
    },
  ]),
)

describe("Typesense catalog indexer", () => {
  it("declares known storefront card fields with numeric and boolean types", () => {
    const schema = buildCollectionSchema(slice, registry)
    expect(schema.fields.find((field) => field.name === "priceFromAmountCents")?.type).toBe("int64")
    expect(schema.fields.find((field) => field.name === "durationDays")?.type).toBe("int64")
    expect(schema.fields.find((field) => field.name === "latitude")?.type).toBe("float")
    expect(schema.fields.find((field) => field.name === "hasOffer")?.type).toBe("bool")
    expect(schema.fields.find((field) => field.name === "nextDepartureAt")?.sort).toBe(true)
    expect(schema.fields.find((field) => field.name === "nextDepartureDate")?.sort).toBe(true)
    expect(schema.metadata).toEqual({
      voyant: {
        defaultQueryBy: "name,categorySlugs",
        defaultSearchFields: ["name", "categorySlugs"],
      },
    })
  })

  it("declares embedding metadata when vector indexing is enabled", () => {
    const schema = buildCollectionSchema(slice, registry, { vectorDimensions: 768 })

    expect(schema.fields.find((field) => field.name === "text_embedding")).toMatchObject({
      type: "float[]",
      num_dim: 768,
      optional: true,
    })
    expect(schema.fields.find((field) => field.name === "embedding_model_id")).toMatchObject({
      type: "string",
      facet: true,
      optional: true,
    })
  })

  it("derives default Typesense query fields from policy-visible searchable text", () => {
    expect(buildDefaultTypesenseSearchFields(registry, slice)).toEqual(["name", "categorySlugs"])
    expect(buildDefaultTypesenseQueryBy(registry, slice)).toBe("name,categorySlugs")
  })

  it("keeps non-search fields out of Typesense query_by", () => {
    const query = buildSearchQuery({ query: "retreat", mode: "keyword" }, registry, slice)
    expect(query.query_by).toBe("name,categorySlugs")
    expect(query.query_by).not.toContain("categorySlugs[]")
    expect(query.query_by).not.toContain("priceFromAmountCents")
    expect(query.query_by).not.toContain("durationDays")
    expect(query.query_by).not.toContain("hasOffer")
    expect(query.query_by).not.toContain("thumbnailUrl")
    expect(query.query_by).not.toContain("status")
  })

  it("maps typed storefront sort options to engine sort fields", () => {
    const query = buildSearchQuery(
      { query: "", mode: "keyword", sort: "price-desc" },
      registry,
      slice,
    )

    expect(query.sort_by).toBe("priceFromAmountCents:desc")
  })

  it("maps departure sort to the sortable local departure date", () => {
    const query = buildSearchQuery(
      { query: "", mode: "keyword", sort: "departure-asc" },
      registry,
      slice,
    )

    expect(query.sort_by).toBe("nextDepartureDate:asc")
  })

  it("normalizes list policy paths for facets and filters", () => {
    const query = buildSearchQuery(
      {
        query: "",
        mode: "keyword",
        facets: [{ field: "categorySlugs[]" }],
        filters: [
          { kind: "in", field: "categorySlugs[]", values: ["cruises", "sailing"] },
          { kind: "eq", field: "departureMonths[]", value: "2026-06" },
        ],
      },
      registry,
    )

    expect(query.facet_by).toBe("categorySlugs")
    expect(query.filter_by).toBe(
      'categorySlugs:["cruises","sailing"] && departureMonths:="2026-06"',
    )
  })

  it("filters vector searches by embedding model id", () => {
    const query = buildSearchQuery(
      {
        query: "retreat",
        mode: "hybrid",
        query_embedding: [0.1, 0.2, 0.3],
        query_embedding_model_id: "gemini/text-embedding-004",
        filters: [{ kind: "eq", field: "categorySlugs[]", value: "london" }],
      },
      registry,
      slice,
    )

    expect(query.vector_query).toContain("text_embedding")
    expect(query.filter_by).toBe(
      'categorySlugs:="london" && embedding_model_id:="gemini/text-embedding-004"',
    )
  })

  it("does not sort public slices by staff-only newest fields", () => {
    const query = buildSearchQuery({ query: "", mode: "keyword", sort: "newest" }, registry, slice)

    expect(query.sort_by).toBeUndefined()
  })

  it("patches default search metadata onto existing collections without field diffs", async () => {
    const updatePayloads: Partial<ReturnType<typeof buildCollectionSchema>>[] = []
    const existingSchema = buildCollectionSchema(slice, registry)
    const client: TypesenseClient = {
      collections: () => ({
        create: async () => {
          throw new Error("already exists")
        },
        update: async (schema) => {
          updatePayloads.push(schema)
        },
        delete: async () => undefined,
        retrieve: async () => ({
          name: existingSchema.name,
          fields: existingSchema.fields,
          enable_nested_fields: true,
        }),
        documents: () => ({
          import: async () => ({}),
          delete: async () => undefined,
          search: async () => ({ hits: [], found: 0 }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({ client })

    await indexer.ensureCollection(slice, registry)

    expect(updatePayloads).toEqual([
      {
        metadata: {
          voyant: {
            defaultQueryBy: "name,categorySlugs",
            defaultSearchFields: ["name", "categorySlugs"],
          },
        },
      },
    ])
  })

  it("skips collection updates when the existing schema and metadata already match", async () => {
    const existingSchema = buildCollectionSchema(slice, registry)
    let updateCalls = 0
    const client: TypesenseClient = {
      collections: () => ({
        create: async () => {
          throw new Error("already exists")
        },
        update: async () => {
          updateCalls += 1
        },
        delete: async () => undefined,
        retrieve: async () => existingSchema,
        documents: () => ({
          import: async () => ({}),
          delete: async () => undefined,
          search: async () => ({ hits: [], found: 0 }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({ client })

    await indexer.ensureCollection(slice, registry)

    expect(updateCalls).toBe(0)
  })

  it("retries transient Typesense collection update conflicts", async () => {
    const existingSchema = buildCollectionSchema(slice, registry)
    let updateCalls = 0
    const client: TypesenseClient = {
      collections: () => ({
        create: async () => {
          throw new Error("already exists")
        },
        update: async () => {
          updateCalls += 1
          if (updateCalls < 3) {
            throw new Error(
              'Typesense PATCH /collections/products__en-GB__customer__default 422: {"message":"Another collection update operation is in progress."}',
            )
          }
        },
        delete: async () => undefined,
        retrieve: async () => ({
          name: existingSchema.name,
          fields: existingSchema.fields,
          enable_nested_fields: true,
        }),
        documents: () => ({
          import: async () => ({}),
          delete: async () => undefined,
          search: async () => ({ hits: [], found: 0 }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({
      client,
      collectionUpdateRetryDelaysMs: [0, 0],
    })

    await indexer.ensureCollection(slice, registry)

    expect(updateCalls).toBe(3)
  })

  it("upserts storefront card values without stringifying typed fields", async () => {
    const imported: unknown[][] = []
    const client: TypesenseClient = {
      collections: () => ({
        create: async () => undefined,
        update: async () => undefined,
        delete: async () => undefined,
        retrieve: async () => ({ name: "unused", fields: [] }),
        documents: () => ({
          import: async (documents: unknown[]) => {
            imported.push(documents)
            return {}
          },
          delete: async () => undefined,
          search: async () => ({ hits: [], found: 0 }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({ client })
    const document: IndexerDocument = {
      id: "prod_abc",
      fields: {
        name: "Retreat",
        priceFromAmountCents: "125000",
        durationDays: 4,
        latitude: "45.76",
        hasOffer: true,
      },
    }

    await indexer.upsert(slice, [document])

    expect(imported[0]?.[0]).toMatchObject({
      id: "prod_abc",
      name: "Retreat",
      priceFromAmountCents: 125000,
      durationDays: 4,
      latitude: 45.76,
      hasOffer: true,
    })
  })

  it("upserts embedded documents without undeclared schema fields", async () => {
    let fieldNames = new Set<string>()
    const client: TypesenseClient = {
      collections: () => ({
        create: async (schema) => {
          fieldNames = new Set(["id", ...schema.fields.map((field) => field.name)])
        },
        update: async () => undefined,
        delete: async () => undefined,
        retrieve: async () => ({ name: "unused", fields: [] }),
        documents: () => ({
          import: async (documents: unknown[]) => {
            const unknownFields = documents.flatMap((rawDocument) =>
              Object.keys(rawDocument as Record<string, unknown>).filter(
                (key) => !fieldNames.has(key),
              ),
            )
            if (unknownFields.length > 0) {
              return unknownFields
                .map((field) =>
                  JSON.stringify({
                    success: false,
                    error: `Field \`${field}\` is not declared in the collection schema`,
                  }),
                )
                .join("\n")
            }
            return documents.map(() => JSON.stringify({ success: true })).join("\n")
          },
          delete: async () => undefined,
          search: async () => ({ hits: [], found: 0 }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({
      client,
      vectorDimensions: 3,
      collectionUpdateRetryDelaysMs: [],
    })

    await indexer.ensureCollection(slice, registry)
    await expect(
      indexer.upsert(slice, [
        {
          id: "prod_abc",
          fields: { name: "London 3-Day Essentials" },
          embeddings: { text_embedding: [0.1, 0.2, 0.3] },
          embedding_model_id: "gemini/text-embedding-004",
        },
      ]),
    ).resolves.toBeUndefined()
  })

  it("deletes documents through Typesense's reserved id field filter", async () => {
    const documentsById = new Map<string, Record<string, unknown>>()
    const client: TypesenseClient = {
      collections: () => ({
        create: async () => undefined,
        update: async () => undefined,
        delete: async () => undefined,
        retrieve: async () => ({ name: "unused", fields: [] }),
        documents: () => ({
          import: async (documents: unknown[]) => {
            for (const rawDocument of documents) {
              const indexedDocument = rawDocument as Record<string, unknown>
              documentsById.set(String(indexedDocument.id), indexedDocument)
            }
            return {}
          },
          delete: async (query) => {
            if (query.filter_by !== "id:[prod_abc,prod_def]") {
              return { num_deleted: 0 }
            }
            let numDeleted = 0
            for (const id of ["prod_abc", "prod_def"]) {
              if (documentsById.delete(id)) {
                numDeleted += 1
              }
            }
            return { num_deleted: numDeleted }
          },
          search: async () => ({ hits: [], found: documentsById.size }),
        }),
      }),
    }
    const indexer = createTypesenseIndexer({ client })

    await indexer.upsert(slice, [
      { id: "prod_abc", fields: { name: "Retreat" } },
      { id: "prod_def", fields: { name: "Cruise" } },
    ])
    await indexer.delete(slice, ["prod_abc", "prod_def"])

    expect([...documentsById.keys()]).toEqual([])
  })
})

const document: IndexerDocument = { id: "prod_abc", fields: { name: "Retreat" } }

function clientReturningImport(result: unknown): TypesenseClient {
  return {
    collections: () => ({
      create: async () => undefined,
      update: async () => undefined,
      delete: async () => undefined,
      retrieve: async () => ({ name: "unused", fields: [] }),
      documents: () => ({
        import: async () => result,
        delete: async () => undefined,
        search: async () => ({ hits: [], found: 0 }),
      }),
    }),
  }
}

describe("Typesense import-failure detection", () => {
  const okLine = JSON.stringify({ success: true })
  const failLine = JSON.stringify({
    success: false,
    error: "Field `categorySlugs` must be an array",
    document: '{"id":"prod_abc"}',
  })

  it("parses an NDJSON import body into per-row results", () => {
    const rows = parseTypesenseImportResults(`${okLine}\n${failLine}`)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.success).toBe(true)
    expect(rows[1]).toMatchObject({
      success: false,
      error: "Field `categorySlugs` must be an array",
      document: '{"id":"prod_abc"}',
    })
  })

  it("parses an already-parsed SDK results array", () => {
    const rows = parseTypesenseImportResults([{ success: true }, { success: false, error: "boom" }])
    expect(rows.map((r) => r.success)).toEqual([true, false])
    expect(rows[1]?.error).toBe("boom")
  })

  it("treats non-inspectable responses (e.g. a `{}` double) as no failures", () => {
    expect(summarizeImportFailures("c", {})).toBeNull()
    expect(summarizeImportFailures("c", undefined)).toBeNull()
    expect(summarizeImportFailures("c", `${okLine}\n${okLine}`)).toBeNull()
  })

  it("summarizes failures with counts and capped representative samples", () => {
    const body = [failLine, failLine, failLine].join("\n")
    const summary = summarizeImportFailures("products__en-GB__customer__default", body, 2)
    expect(summary).toMatchObject({
      collection: "products__en-GB__customer__default",
      failed: 3,
      total: 3,
    })
    expect(summary?.samples).toHaveLength(2)
    expect(summary?.samples[0]).toContain("Field `categorySlugs` must be an array")
  })

  it("upsert throws TypesenseImportError when any row fails (default mode)", async () => {
    const indexer = createTypesenseIndexer({
      client: clientReturningImport(`${okLine}\n${failLine}`),
    })
    await expect(indexer.upsert(slice, [document])).rejects.toBeInstanceOf(TypesenseImportError)
  })

  it("best-effort mode reports failures via onImportFailure without throwing", async () => {
    const reported: ImportFailureSummary[] = []
    const indexer = createTypesenseIndexer({
      client: clientReturningImport(`${okLine}\n${failLine}`),
      importFailureMode: "best-effort",
      onImportFailure: (summary) => reported.push(summary),
    })
    await expect(indexer.upsert(slice, [document])).resolves.toBeUndefined()
    expect(reported).toHaveLength(1)
    expect(reported[0]?.failed).toBe(1)
  })

  it("does not throw when every row succeeds", async () => {
    const indexer = createTypesenseIndexer({
      client: clientReturningImport(`${okLine}\n${okLine}`),
    })
    await expect(indexer.upsert(slice, [document])).resolves.toBeUndefined()
  })

  it("bulkReindex throws on row failure so the reindex CLI exits non-zero", async () => {
    const indexer = createTypesenseIndexer({
      client: clientReturningImport(`${okLine}\n${failLine}`),
    })
    async function* stream(): AsyncIterable<IndexerDocument> {
      yield document
    }
    await expect(indexer.bulkReindex(slice, stream())).rejects.toBeInstanceOf(TypesenseImportError)
  })
})
