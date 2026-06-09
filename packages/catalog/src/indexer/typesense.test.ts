import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import type { IndexerDocument, IndexerSlice } from "./contract.js"
import {
  buildCollectionSchema,
  buildDefaultTypesenseQueryBy,
  buildDefaultTypesenseSearchFields,
  buildSearchQuery,
  createTypesenseIndexer,
  type TypesenseClient,
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
})
