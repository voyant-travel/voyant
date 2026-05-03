import { describe, expect, it } from "vitest"

import type { SourceAdapter } from "../adapter/contract.js"
import type { FieldPolicyRegistry } from "../contract.js"
import type {
  IndexerDocument,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "../indexer/contract.js"
import type { DocumentBuilder, IndexerService } from "../services/indexer-service.js"

import { createSourceAdapterRegistry } from "./registry.js"
import { syncSources } from "./sync.js"

/**
 * Stub IndexerService that records every reindex call and synthesizes
 * its own slices so the sync's pagination + dispatch are observable
 * without spinning up Typesense.
 */
function makeStubIndexer(slicesByVertical: Record<string, IndexerSlice[]>): {
  service: IndexerService
  upserted: Array<{ slice: IndexerSlice; doc: IndexerDocument }>
} {
  const upserted: Array<{ slice: IndexerSlice; doc: IndexerDocument }> = []
  const service: IndexerService = {
    async ensureCollections() {},
    async reindexEntity(entityModule, entityId, builder: DocumentBuilder) {
      const slices = slicesByVertical[entityModule] ?? []
      for (const slice of slices) {
        const doc = await builder(entityId, slice)
        if (doc) upserted.push({ slice, doc })
      }
    },
    async reindexEntityForSlice(slice, entityId, builder: DocumentBuilder) {
      const doc = await builder(entityId, slice)
      if (doc) upserted.push({ slice, doc })
    },
    async deleteEntity() {},
    async search(_slice: IndexerSlice, _request: SearchRequest): Promise<SearchResults> {
      return { total: 0, hits: [] }
    },
    slicesForVertical(entityModule: string): IndexerSlice[] {
      return slicesByVertical[entityModule] ?? []
    },
  }
  return { service, upserted }
}

/**
 * Stub field-policy registry that pretends every projection field is
 * indexed and visible to staff. The sync's job is to call
 * `buildIndexerDocument` with the right registry, slice, and entity id —
 * the registry's actual policy logic is covered by other tests.
 */
function makePassthroughRegistry(): FieldPolicyRegistry {
  return {
    resolve(path: string) {
      return {
        path,
        class: "managed",
        merge: "source-only",
        drift: "low",
        reindex: "entry",
        snapshot: "never",
        query: "indexed-column",
        localized: false,
        visibility: ["staff", "customer", "partner", "supplier"],
        editRole: "none",
        overrideFriction: "none",
        sourceFreshness: "static",
      }
    },
    paths(): string[] {
      return []
    },
  } as unknown as FieldPolicyRegistry
}

function makeAdapter(
  kind: string,
  pages: Array<{ projections: string[]; next?: string }>,
): SourceAdapter {
  let pageIdx = 0
  return {
    kind,
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: false,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      postBookOperations: [],
    },
    connect: async () => undefined,
    pause: async () => undefined,
    disconnect: async () => undefined,
    getState: async () => "active",
    discover: async () => {
      const page = pages[pageIdx] ?? { projections: [], next: undefined }
      pageIdx += 1
      return {
        projections: page.projections.map((id) => ({
          entity_module: "products",
          entity_id: id,
          provenance: { source_kind: kind, source_freshness: "sync" as const },
          fields: { id, name: `Inventory ${id}`, status: "active" },
        })),
        next_cursor: page.next,
      }
    },
  }
}

describe("syncSources", () => {
  it("paginates discovery and pushes each projection into every slice for the vertical", async () => {
    const registry = createSourceAdapterRegistry()
    registry.register(
      makeAdapter("demo", [
        { projections: ["a", "b"], next: "page-2" },
        { projections: ["c"], next: undefined },
      ]),
    )

    const slices: IndexerSlice[] = [
      { vertical: "products", locale: "en-GB", audience: "staff", market: "default" },
      { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
    ]
    const { service, upserted } = makeStubIndexer({ products: slices })
    const fieldPolicyRegistries = new Map([["products", makePassthroughRegistry()]])

    const summary = await syncSources({
      registry,
      indexerService: service,
      fieldPolicyRegistries,
    })

    expect(summary.totalProjections).toBe(3)
    expect(summary.adapters[0]?.pages).toBe(2)
    expect(summary.adapters[0]?.projectionsSynced).toBe(3)
    expect(summary.adapters[0]?.verticalsTouched).toEqual(["products"])
    // 3 projections × 2 slices = 6 upserts
    expect(upserted).toHaveLength(6)
    expect(upserted.map((u) => u.doc.id).sort()).toEqual(["a", "a", "b", "b", "c", "c"])
  })

  it("skips projections whose vertical has no field-policy registry", async () => {
    const registry = createSourceAdapterRegistry()
    registry.register(makeAdapter("demo", [{ projections: ["x"], next: undefined }]))

    const slices: IndexerSlice[] = [
      { vertical: "products", locale: "en-GB", audience: "staff", market: "default" },
    ]
    const { service, upserted } = makeStubIndexer({ products: slices })
    // Empty registry map → projection should be skipped, not crash.
    const summary = await syncSources({
      registry,
      indexerService: service,
      fieldPolicyRegistries: new Map(),
    })

    expect(summary.totalProjections).toBe(0)
    expect(summary.adapters[0]?.projectionsSynced).toBe(0)
    expect(summary.adapters[0]?.skippedNoRegistry).toBe(1)
    expect(upserted).toHaveLength(0)
  })

  it("emits onProgress per page", async () => {
    const registry = createSourceAdapterRegistry()
    registry.register(
      makeAdapter("demo", [
        { projections: ["a", "b"], next: "p2" },
        { projections: ["c"], next: undefined },
      ]),
    )
    const { service } = makeStubIndexer({
      products: [{ vertical: "products", locale: "en-GB", audience: "staff", market: "default" }],
    })
    const fieldPolicyRegistries = new Map([["products", makePassthroughRegistry()]])

    const events: number[] = []
    await syncSources({
      registry,
      indexerService: service,
      fieldPolicyRegistries,
      onProgress(event) {
        events.push(event.pageSize)
      },
    })
    expect(events).toEqual([2, 1])
  })

  it("applies wrapBuilder to every per-projection builder", async () => {
    const registry = createSourceAdapterRegistry()
    registry.register(makeAdapter("demo", [{ projections: ["a"], next: undefined }]))
    const { service, upserted } = makeStubIndexer({
      products: [{ vertical: "products", locale: "en-GB", audience: "staff", market: "default" }],
    })
    const fieldPolicyRegistries = new Map([["products", makePassthroughRegistry()]])

    let wrapped = 0
    await syncSources({
      registry,
      indexerService: service,
      fieldPolicyRegistries,
      wrapBuilder(inner) {
        wrapped += 1
        return async (entityId, slice) => {
          const doc = await inner(entityId, slice)
          if (!doc) return null
          return {
            ...doc,
            fields: { ...doc.fields, wrapped: true },
          }
        }
      },
    })

    expect(wrapped).toBe(1)
    expect(upserted[0]?.doc.fields.wrapped).toBe(true)
  })
})
