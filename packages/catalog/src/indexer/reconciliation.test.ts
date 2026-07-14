import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it, vi } from "vitest"
import { createIndexerService } from "../services/indexer-service.js"
import {
  IndexerAdminUnavailableError,
  type ReconcileIndexerOptions,
  reconcileIndexer,
} from "./reconciliation.js"

const productsCurrent: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "current",
}
const productsObsolete: IndexerSlice = { ...productsCurrent, market: "obsolete" }
const productsUntargeted: IndexerSlice = { ...productsCurrent, market: "untargeted" }
const unrelatedSlice: IndexerSlice = { ...productsCurrent, vertical: "cruises" }

describe("reconcileIndexer", () => {
  it("deletes only stale documents owned by the reconciliation", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, [document("owned-live"), document("owned-stale"), document("foreign")]],
    ])
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [
        {
          slice: productsCurrent,
          loadDocuments: () => [
            document("owned-live"),
            document("owned-new"),
            document("owned-third"),
          ],
        },
      ],
    )

    const result = await reconcileIndexer(options)

    expect(result).toEqual({
      mode: "full",
      indexedDocuments: 3,
      deletedDocuments: 1,
      droppedSlices: 0,
    })
    expect(fake.ids(productsCurrent)).toEqual(["foreign", "owned-live", "owned-new", "owned-third"])
    expect(fake.upsert.mock.calls.map(([, documents]) => documents.map(({ id }) => id))).toEqual([
      ["owned-live", "owned-new"],
      ["owned-third"],
    ])
    expect(fake.deleted).toEqual([[productsCurrent, ["owned-stale"]]])
  })

  it("finishes scanning before deleting stale documents in batches", async () => {
    const fake = createFakeAdapter([
      [
        productsCurrent,
        [
          document("owned-live"),
          document("owned-stale-1"),
          document("owned-stale-2"),
          document("owned-stale-3"),
        ],
      ],
    ])
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(options)).resolves.toMatchObject({ deletedDocuments: 3 })
    expect(fake.deleted).toEqual([
      [productsCurrent, ["owned-stale-1", "owned-stale-2"]],
      [productsCurrent, ["owned-stale-3"]],
    ])
  })

  it("drops obsolete owned slices without touching unrelated slices", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [productsObsolete, [document("owned-old")]],
      [unrelatedSlice, [document("foreign-old")]],
    ])
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )

    const result = await reconcileIndexer(options)

    expect(result.droppedSlices).toBe(1)
    expect(fake.has(productsObsolete)).toBe(false)
    expect(fake.has(unrelatedSlice)).toBe(true)
    expect(fake.dropped).toEqual([productsObsolete])
  })

  it("does not drop configured owned slices omitted from a partial target run", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [productsUntargeted, [document("owned-untargeted")]],
      [productsObsolete, [document("owned-old")]],
    ])
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent, productsUntargeted],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )

    await expect(reconcileIndexer(options)).resolves.toMatchObject({ droppedSlices: 1 })
    expect(fake.has(productsUntargeted)).toBe(true)
    expect(fake.has(productsObsolete)).toBe(false)
    expect(fake.dropped).toEqual([productsObsolete])
  })

  it("is idempotent after stale documents and slices are removed", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, [document("owned-live"), document("owned-stale")]],
      [productsObsolete, []],
    ])
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(options)).resolves.toMatchObject({
      deletedDocuments: 1,
      droppedSlices: 1,
    })
    await expect(reconcileIndexer(options)).resolves.toEqual({
      mode: "full",
      indexedDocuments: 1,
      deletedDocuments: 0,
      droppedSlices: 0,
    })
    expect(fake.ids(productsCurrent)).toEqual(["owned-live"])
  })

  it("loads a fresh one-shot generator when an attempt is retried", async () => {
    const fake = createFakeAdapter([], false)
    const loadDocuments = vi.fn(() =>
      (function* () {
        yield document("owned-live")
        yield document("owned-new")
      })(),
    )
    const options = {
      ...reconciliationOptions(
        fake.adapter,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments }],
      ),
      onMissingAdmin: "upsert-only" as const,
    }
    fake.upsert.mockRejectedValueOnce(new Error("temporary index failure"))

    await expect(reconcileIndexer(options)).rejects.toThrow("temporary index failure")
    await expect(reconcileIndexer(options)).resolves.toMatchObject({ indexedDocuments: 2 })
    expect(loadDocuments).toHaveBeenCalledTimes(2)
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-new"])
  })

  it("fails before mutation when the adapter has no admin surface", async () => {
    const fake = createFakeAdapter([], false)
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(options)).rejects.toBeInstanceOf(IndexerAdminUnavailableError)
    expect(fake.upsert).not.toHaveBeenCalled()
  })

  it("supports explicit non-destructive reconciliation without admin", async () => {
    const fake = createFakeAdapter([[productsCurrent, [document("owned-stale")]]], false)
    const options = reconciliationOptions(
      fake.adapter,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer({ ...options, onMissingAdmin: "upsert-only" })).resolves.toEqual({
      mode: "upsert-only",
      indexedDocuments: 1,
      deletedDocuments: 0,
      droppedSlices: 0,
    })
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-stale"])
    expect(fake.deleted).toEqual([])
    expect(fake.dropped).toEqual([])
    expect(fake.bulkReindex).not.toHaveBeenCalled()
  })
})

function reconciliationOptions(
  adapter: IndexerAdapter,
  slices: IndexerSlice[],
  targets: ReconcileIndexerOptions["targets"],
): ReconcileIndexerOptions {
  return {
    adapter,
    service: createIndexerService({ adapter, slices, registries: new Map() }),
    targets,
    ownership: {
      ownsSlice: (slice) => slice.vertical === "products",
      ownsDocument: (_slice, indexedDocument) => indexedDocument.id.startsWith("owned-"),
    },
    batchSize: 2,
  }
}

function document(id: string): IndexerDocument {
  return { id, fields: { title: id } }
}

function createFakeAdapter(
  initial: ReadonlyArray<readonly [IndexerSlice, ReadonlyArray<IndexerDocument>]>,
  withAdmin = true,
) {
  const collections = new Map<
    string,
    { slice: IndexerSlice; documents: Map<string, IndexerDocument> }
  >()
  for (const [slice, documents] of initial) {
    collections.set(sliceKey(slice), {
      slice,
      documents: new Map(documents.map((indexedDocument) => [indexedDocument.id, indexedDocument])),
    })
  }

  const deleted: Array<[IndexerSlice, string[]]> = []
  const dropped: IndexerSlice[] = []
  let scanActive = false
  const upsert = vi.fn<IndexerAdapter["upsert"]>(async (slice, documents) => {
    const collection = getOrCreateCollection(collections, slice)
    for (const indexedDocument of documents) {
      collection.documents.set(indexedDocument.id, indexedDocument)
    }
  })
  const bulkReindex = vi.fn<IndexerAdapter["bulkReindex"]>(async (slice, stream) => {
    const collection = getOrCreateCollection(collections, slice)
    for await (const indexedDocument of stream) {
      collection.documents.set(indexedDocument.id, indexedDocument)
    }
  })
  const capabilities: IndexerCapabilities = {
    supportsKeywordSearch: true,
    supportsHybridSearch: false,
    supportsVectorFields: false,
    vectorDimensions: null,
    maxVectorsPerDocument: null,
    supportsCrossAudienceFederation: false,
    supportsAdminDenormalization: false,
  }

  const adapter: IndexerAdapter = {
    capabilities,
    ...(withAdmin
      ? {
          admin: {
            async list() {
              return [...collections.values()].map(({ slice }) => slice)
            },
            async drop(slice: IndexerSlice) {
              const removed = collections.delete(sliceKey(slice))
              if (removed) dropped.push(slice)
              return removed
            },
            async *scan(slice: IndexerSlice) {
              scanActive = true
              try {
                const collection = collections.get(sliceKey(slice))
                for (const indexedDocument of collection?.documents.values() ?? []) {
                  yield indexedDocument
                }
              } finally {
                scanActive = false
              }
            },
          },
        }
      : {}),
    async ensureCollection(slice) {
      getOrCreateCollection(collections, slice)
    },
    upsert,
    async delete(slice, ids) {
      if (scanActive) throw new Error("delete called while admin scan was active")
      const collection = collections.get(sliceKey(slice))
      for (const id of ids) collection?.documents.delete(id)
      deleted.push([slice, [...ids]])
    },
    async search(): Promise<SearchResults> {
      return { hits: [], total: 0 }
    },
    bulkReindex,
  }

  return {
    adapter,
    upsert,
    bulkReindex,
    deleted,
    dropped,
    has: (slice: IndexerSlice) => collections.has(sliceKey(slice)),
    ids: (slice: IndexerSlice) =>
      [...(collections.get(sliceKey(slice))?.documents.keys() ?? [])].sort(),
  }
}

function getOrCreateCollection(
  collections: Map<string, { slice: IndexerSlice; documents: Map<string, IndexerDocument> }>,
  slice: IndexerSlice,
) {
  const key = sliceKey(slice)
  let collection = collections.get(key)
  if (!collection) {
    collection = { slice, documents: new Map() }
    collections.set(key, collection)
  }
  return collection
}

function sliceKey(slice: IndexerSlice): string {
  return JSON.stringify([
    slice.vertical,
    slice.locale,
    slice.audience,
    slice.market,
    slice.channel ?? null,
  ])
}
