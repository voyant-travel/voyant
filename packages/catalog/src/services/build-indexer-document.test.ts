import type { IndexerSlice } from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"
import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import { buildIndexerDocument } from "./indexer-service.js"

const registry = createFieldPolicyRegistry(
  defineFieldPolicy([
    {
      path: "title",
      class: "merchandisable",
      merge: "replace",
      editRole: "marketing",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["staff", "customer", "partner"],
    },
    {
      path: "description",
      class: "merchandisable",
      merge: "replace",
      editRole: "marketing",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "blob-only", // stored on the entity row but not indexed
      visibility: ["staff", "customer", "partner"],
    },
    {
      path: "internal_notes",
      class: "merchandisable",
      merge: "replace",
      editRole: "ops",
      overrideFriction: "none",
      snapshot: "never",
      query: "indexed-column",
      visibility: ["staff"],
    },
    {
      path: "tags[]",
      class: "merchandisable",
      merge: "additive-set",
      editRole: "marketing",
      overrideFriction: "none",
      snapshot: "on-book",
      query: "indexed-column",
      visibility: ["staff", "customer", "partner"],
    },
  ]),
)

const customerSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

const adminSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "staff-admin",
  market: "default",
}

const projection = new Map<string, unknown>([
  ["title", "Bali Wellness"],
  ["description", "A long description"],
  ["internal_notes", "Margin tight, push hard in Q3"],
  ["tags[]", ["wellness", "yoga"]],
])

describe("buildIndexerDocument", () => {
  it("includes the entity id in the returned document", () => {
    const doc = buildIndexerDocument(registry, projection, customerSlice, "prod_xyz")
    expect(doc.id).toBe("prod_xyz")
  })

  it("skips blob-only fields (description) — stored on row, not indexed", () => {
    const doc = buildIndexerDocument(registry, projection, customerSlice, "prod_xyz")
    expect(doc.fields).not.toHaveProperty("description")
  })

  it("excludes staff-only fields from customer-audience documents", () => {
    const doc = buildIndexerDocument(registry, projection, customerSlice, "prod_xyz")
    expect(doc.fields).not.toHaveProperty("internal_notes")
    expect(doc.fields).toHaveProperty("title")
  })

  it("includes staff-only fields in admin documents (cross-audience denormalization)", () => {
    const doc = buildIndexerDocument(registry, projection, adminSlice, "prod_xyz")
    expect(doc.fields).toHaveProperty("internal_notes")
    expect(doc.fields).toHaveProperty("title")
  })

  it("strips `[]` suffix from list-field names", () => {
    const doc = buildIndexerDocument(registry, projection, customerSlice, "prod_xyz")
    expect(doc.fields).toHaveProperty("tags")
    expect(doc.fields).not.toHaveProperty("tags[]")
    expect(doc.fields.tags).toEqual(["wellness", "yoga"])
  })

  it("accepts natural projection keys for list policies", () => {
    const doc = buildIndexerDocument(
      registry,
      new Map<string, unknown>([["tags", ["wellness", "yoga"]]]),
      customerSlice,
      "prod_xyz",
    )
    expect(doc.fields.tags).toEqual(["wellness", "yoga"])
  })

  it("ignores fields not declared in the registry", () => {
    const projectionWithExtra = new Map<string, unknown>([
      ["title", "Hello"],
      ["phantom_field", "????"],
    ])
    const doc = buildIndexerDocument(registry, projectionWithExtra, customerSlice, "prod_xyz")
    expect(doc.fields).toHaveProperty("title")
    expect(doc.fields).not.toHaveProperty("phantom_field")
  })
})
