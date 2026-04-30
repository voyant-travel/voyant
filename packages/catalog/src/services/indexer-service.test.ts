import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
} from "../indexer/contract.js"
import { createIndexerService } from "./indexer-service.js"

interface AdapterCall {
  op: "ensureCollection" | "upsert" | "delete" | "search" | "bulkReindex"
  slice: IndexerSlice
  ids?: string[]
  documents?: IndexerDocument[]
}

function createStubAdapter(): IndexerAdapter & { calls: AdapterCall[] } {
  const calls: AdapterCall[] = []
  const capabilities: IndexerCapabilities = {
    supportsKeywordSearch: true,
    supportsHybridSearch: false,
    supportsVectorFields: false,
    vectorDimensions: null,
    maxVectorsPerDocument: null,
    supportsCrossAudienceFederation: false,
    supportsAdminDenormalization: false,
  }

  return {
    capabilities,
    calls,
    async ensureCollection(slice) {
      calls.push({ op: "ensureCollection", slice })
    },
    async upsert(slice, documents) {
      calls.push({ op: "upsert", slice, documents })
    },
    async delete(slice, ids) {
      calls.push({ op: "delete", slice, ids })
    },
    async search(slice, _request) {
      calls.push({ op: "search", slice })
      return { hits: [], total: 0 }
    },
    async bulkReindex(slice, _stream, _options) {
      calls.push({ op: "bulkReindex", slice })
    },
  }
}

const merchandisable = {
  class: "merchandisable" as const,
  merge: "replace" as const,
  editRole: "marketing" as const,
  overrideFriction: "none" as const,
  snapshot: "on-book" as const,
}

const productsRegistry = createFieldPolicyRegistry(
  defineFieldPolicy([{ path: "title", ...merchandisable, visibility: ["staff", "customer"] }]),
)
const cruisesRegistry = createFieldPolicyRegistry(
  defineFieldPolicy([{ path: "name", ...merchandisable, visibility: ["staff", "customer"] }]),
)

const productSlices: IndexerSlice[] = [
  { vertical: "products", locale: "en-GB", audience: "staff-admin", market: "default" },
  { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
]
const cruiseSlices: IndexerSlice[] = [
  { vertical: "cruises", locale: "en-GB", audience: "customer", market: "default" },
]

describe("IndexerService", () => {
  it("ensures collections across every configured slice", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [...productSlices, ...cruiseSlices],
      registries: new Map([
        ["products", productsRegistry],
        ["cruises", cruisesRegistry],
      ]),
    })

    await service.ensureCollections()
    const ensureCalls = adapter.calls.filter((c) => c.op === "ensureCollection")
    expect(ensureCalls).toHaveLength(3)
  })

  it("reindexes one entity across only its vertical's slices", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [...productSlices, ...cruiseSlices],
      registries: new Map([
        ["products", productsRegistry],
        ["cruises", cruisesRegistry],
      ]),
    })

    await service.reindexEntity("products", "prod_xyz", async (entityId, slice) => ({
      id: entityId,
      fields: { title: `${slice.audience} title` },
    }))

    const upsertCalls = adapter.calls.filter((c) => c.op === "upsert")
    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls.every((c) => c.slice.vertical === "products")).toBe(true)
    // Each slice received its own document with audience-specific fields.
    expect(upsertCalls[0]?.documents?.[0]?.fields.title).toBe("staff-admin title")
    expect(upsertCalls[1]?.documents?.[0]?.fields.title).toBe("customer title")
  })

  it("reindexEntityForSlice writes to exactly one slice", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [...productSlices, ...cruiseSlices],
      registries: new Map([
        ["products", productsRegistry],
        ["cruises", cruisesRegistry],
      ]),
    })

    const customerSlice = productSlices[1]!
    await service.reindexEntityForSlice(customerSlice, "prod_xyz", async () => ({
      id: "prod_xyz",
      fields: { title: "customer title" },
    }))

    const upsertCalls = adapter.calls.filter((c) => c.op === "upsert")
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.slice).toEqual(customerSlice)
  })

  it("deletes one entity from every slice configured for its vertical", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [...productSlices, ...cruiseSlices],
      registries: new Map([
        ["products", productsRegistry],
        ["cruises", cruisesRegistry],
      ]),
    })

    await service.deleteEntity("products", "prod_xyz")
    const deleteCalls = adapter.calls.filter((c) => c.op === "delete")
    expect(deleteCalls).toHaveLength(2)
    expect(deleteCalls.every((c) => c.ids?.includes("prod_xyz"))).toBe(true)
  })

  it("skips slices when the document builder returns null", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: productSlices,
      registries: new Map([["products", productsRegistry]]),
    })

    await service.reindexEntity("products", "prod_xyz", async (_entityId, slice) =>
      slice.audience === "customer" ? null : { id: "prod_xyz", fields: {} },
    )

    const upsertCalls = adapter.calls.filter((c) => c.op === "upsert")
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.slice.audience).toBe("staff-admin")
  })

  it("throws when reindexing for a vertical without a registered registry", async () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [{ vertical: "phantom", locale: "en-GB", audience: "customer", market: "default" }],
      registries: new Map(),
    })

    await expect(service.ensureCollections()).rejects.toThrow(/no field-policy registry/)
  })

  it("slicesForVertical filters down correctly", () => {
    const adapter = createStubAdapter()
    const service = createIndexerService({
      adapter,
      slices: [...productSlices, ...cruiseSlices],
      registries: new Map([
        ["products", productsRegistry],
        ["cruises", cruisesRegistry],
      ]),
    })
    expect(service.slicesForVertical("products")).toHaveLength(2)
    expect(service.slicesForVertical("cruises")).toHaveLength(1)
    expect(service.slicesForVertical("phantom")).toHaveLength(0)
  })
})
