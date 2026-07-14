import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type {
  IndexerAdapter,
  IndexerCapabilities,
  IndexerDocument,
  IndexerSlice,
  SearchResults,
} from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it, vi } from "vitest"
import type { FieldPolicyRegistry } from "../contract.js"
import {
  createIndexerService,
  type IndexerExclusiveWriteLease,
} from "../services/indexer-service.js"
import {
  createFileIndexerReconciliationStateStore,
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
const productsObsoleteSecond: IndexerSlice = { ...productsCurrent, market: "obsolete-second" }
const productsUntargeted: IndexerSlice = { ...productsCurrent, market: "untargeted" }
const unrelatedSlice: IndexerSlice = { ...productsCurrent, vertical: "cruises" }

describe("reconcileIndexer", () => {
  it("deletes only stale documents owned by the reconciliation", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, [document("owned-live"), document("owned-stale"), document("foreign")]],
    ])
    const options = reconciliationOptions(
      fake,
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

    const result = await runReconciliation(options)

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
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(runReconciliation(options)).resolves.toMatchObject({ deletedDocuments: 3 })
    expect(fake.deleted).toEqual([
      [productsCurrent, ["owned-stale-1", "owned-stale-2"]],
      [productsCurrent, ["owned-stale-3"]],
    ])
  })

  it("holds concurrent service writes outside the destructive scan boundary", async () => {
    const scanStarted = createDeferred<void>()
    const releaseScan = createDeferred<void>()
    const fake = createFakeAdapter(
      [[productsCurrent, [document("owned-live"), document("owned-stale")]]],
      {
        onScanStart: async () => {
          scanStarted.resolve()
          await releaseScan.promise
        },
      },
    )
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    const reconciliation = runReconciliation(options)
    await scanStarted.promise
    const concurrentWrite = options.service.reindexEntityForSlice(
      productsCurrent,
      "owned-concurrent",
      async () => document("owned-concurrent"),
    )
    await Promise.resolve()
    expect(fake.upsert).toHaveBeenCalledTimes(1)

    releaseScan.resolve()
    await reconciliation
    await concurrentWrite

    expect(fake.ids(productsCurrent)).toEqual(["owned-concurrent", "owned-live"])
    expect(fake.events.indexOf("delete:owned-stale")).toBeLessThan(
      fake.events.indexOf("upsert:owned-concurrent"),
    )
  })

  it("rejects an expired exclusive write lease", async () => {
    const fake = createFakeAdapter([[productsCurrent, []]])
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )
    let expiredLease: IndexerExclusiveWriteLease | undefined
    await options.service.withExclusiveWriteLease(async (lease) => {
      expiredLease = lease
    })

    await expect(reconcileIndexer({ ...options, lease: expiredLease! })).rejects.toThrow(
      "exclusive write lease is inactive",
    )
    await options.service.withExclusiveWriteLease(async () => {
      await expect(reconcileIndexer({ ...options, lease: expiredLease! })).rejects.toThrow(
        "exclusive write lease is inactive",
      )
    })
  })

  it("ensures target collections before upserting", async () => {
    const fake = createFakeAdapter([])
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(runReconciliation(options)).resolves.toMatchObject({ indexedDocuments: 1 })
    expect(fake.events.slice(0, 2)).toEqual(["ensure:current", "upsert:owned-live"])
    expect(fake.ids(productsCurrent)).toEqual(["owned-live"])
  })

  it("drops only explicit obsolete owned slice candidates", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [productsObsolete, [document("owned-old")]],
      [unrelatedSlice, [document("foreign-old")]],
    ])
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [] }],
      ),
      obsoleteSlices: [productsObsolete],
    }

    const result = await runReconciliation(options)

    expect(result.droppedSlices).toBe(1)
    expect(fake.has(productsObsolete)).toBe(false)
    expect(fake.has(unrelatedSlice)).toBe(true)
    expect(fake.dropped).toEqual([productsObsolete])
    expect(fake.list).not.toHaveBeenCalled()
  })

  it("does not infer obsolete slices from a partial target run", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [productsUntargeted, [document("owned-untargeted")]],
      [productsObsolete, [document("owned-old")]],
    ])
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent, productsUntargeted],
        [{ slice: productsCurrent, loadDocuments: () => [] }],
      ),
      obsoleteSlices: [productsObsolete],
    }

    await expect(runReconciliation(options)).resolves.toMatchObject({ droppedSlices: 1 })
    expect(fake.has(productsUntargeted)).toBe(true)
    expect(fake.has(productsObsolete)).toBe(false)
  })

  it("rejects unowned obsolete candidates before mutation", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [unrelatedSlice, [document("foreign-old")]],
    ])
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [] }],
      ),
      obsoleteSlices: [unrelatedSlice],
    }

    await expect(runReconciliation(options)).rejects.toThrow("does not own obsolete slice")
    expect(fake.ensureCollection).not.toHaveBeenCalled()
    expect(fake.has(unrelatedSlice)).toBe(true)
  })

  it("is idempotent after stale documents and explicit slices are removed", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, [document("owned-live"), document("owned-stale")]],
      [productsObsolete, []],
    ])
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
      ),
      obsoleteSlices: [productsObsolete],
    }

    await expect(runReconciliation(options)).resolves.toMatchObject({
      deletedDocuments: 1,
      droppedSlices: 1,
    })
    await expect(runReconciliation(options)).resolves.toEqual({
      mode: "full",
      indexedDocuments: 1,
      deletedDocuments: 0,
      droppedSlices: 0,
    })
  })

  it("loads a fresh one-shot generator when an attempt is retried", async () => {
    const fake = createFakeAdapter([], { withAdmin: false, failUpsertCalls: [1] })
    const loadDocuments = vi.fn(() =>
      (function* () {
        yield document("owned-live")
        yield document("owned-new")
      })(),
    )
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments }],
      ),
      onMissingAdmin: "upsert-only" as const,
    }

    await expect(runReconciliation(options)).rejects.toThrow("temporary upsert failure")
    await expect(runReconciliation(options)).resolves.toMatchObject({ indexedDocuments: 2 })
    expect(loadDocuments).toHaveBeenCalledTimes(2)
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-new"])
  })

  it("retries idempotently after one upsert batch succeeds", async () => {
    const fake = createFakeAdapter([], { failUpsertCalls: [2] })
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [
        {
          slice: productsCurrent,
          loadDocuments: () => [document("owned-1"), document("owned-2"), document("owned-3")],
        },
      ],
    )

    await expect(runReconciliation(options)).rejects.toThrow("temporary upsert failure")
    expect(fake.ids(productsCurrent)).toEqual(["owned-1", "owned-2"])
    await expect(runReconciliation(options)).resolves.toMatchObject({ indexedDocuments: 3 })
    expect(fake.ids(productsCurrent)).toEqual(["owned-1", "owned-2", "owned-3"])
  })

  it("retries idempotently after one delete batch succeeds", async () => {
    const fake = createFakeAdapter(
      [
        [
          productsCurrent,
          [
            document("owned-live"),
            document("owned-stale-1"),
            document("owned-stale-2"),
            document("owned-stale-3"),
          ],
        ],
      ],
      { failDeleteCalls: [2] },
    )
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(runReconciliation(options)).rejects.toThrow("temporary delete failure")
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-stale-3"])
    await expect(runReconciliation(options)).resolves.toMatchObject({ deletedDocuments: 1 })
    expect(fake.ids(productsCurrent)).toEqual(["owned-live"])
  })

  it("retries idempotently after one slice drop succeeds", async () => {
    const fake = createFakeAdapter(
      [
        [productsCurrent, []],
        [productsObsolete, []],
        [productsObsoleteSecond, []],
      ],
      { failDropCalls: [2] },
    )
    const options = {
      ...reconciliationOptions(
        fake,
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [] }],
      ),
      obsoleteSlices: [productsObsolete, productsObsoleteSecond],
    }

    await expect(runReconciliation(options)).rejects.toThrow("temporary drop failure")
    expect(fake.has(productsObsolete)).toBe(false)
    expect(fake.has(productsObsoleteSecond)).toBe(true)
    await expect(runReconciliation(options)).resolves.toMatchObject({ droppedSlices: 1 })
    expect(fake.has(productsObsoleteSecond)).toBe(false)
  })

  it("removes filesystem state after success and failure", async () => {
    const directory = mkdtempSync(join(tmpdir(), "voyant-reconciliation-test-"))
    const stateStore = createFileIndexerReconciliationStateStore({
      directory,
      expectedIdBuckets: 2,
    })
    try {
      const successful = reconciliationOptions(
        createFakeAdapter([]),
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
      )
      await runReconciliation({ ...successful, stateStore })
      expect(readdirSync(directory)).toEqual([])

      const failing = reconciliationOptions(
        createFakeAdapter([], { failUpsertCalls: [1] }),
        [productsCurrent],
        [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
      )
      await expect(runReconciliation({ ...failing, stateStore })).rejects.toThrow(
        "temporary upsert failure",
      )
      expect(readdirSync(directory)).toEqual([])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("fails before mutation when the service adapter has no admin surface", async () => {
    const fake = createFakeAdapter([], { withAdmin: false })
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(runReconciliation(options)).rejects.toBeInstanceOf(IndexerAdminUnavailableError)
    expect(fake.ensureCollection).not.toHaveBeenCalled()
    expect(fake.upsert).not.toHaveBeenCalled()
  })

  it("supports explicit non-destructive reconciliation without admin", async () => {
    const fake = createFakeAdapter([[productsCurrent, [document("owned-stale")]]], {
      withAdmin: false,
    })
    const options = reconciliationOptions(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(runReconciliation({ ...options, onMissingAdmin: "upsert-only" })).resolves.toEqual(
      {
        mode: "upsert-only",
        indexedDocuments: 1,
        deletedDocuments: 0,
        droppedSlices: 0,
      },
    )
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-stale"])
    expect(fake.deleted).toEqual([])
    expect(fake.dropped).toEqual([])
    expect(fake.bulkReindex).not.toHaveBeenCalled()
  })
})

type TestReconciliationOptions = Omit<ReconcileIndexerOptions, "lease">

function reconciliationOptions(
  fake: ReturnType<typeof createFakeAdapter>,
  slices: IndexerSlice[],
  targets: ReconcileIndexerOptions["targets"],
): TestReconciliationOptions {
  return {
    service: createIndexerService({
      adapter: fake.adapter,
      slices,
      registries: new Map([["products", emptyRegistry]]),
    }),
    targets,
    ownership: {
      ownsSlice: (slice) => slice.vertical === "products",
      ownsDocument: (_slice, indexedDocument) => indexedDocument.id.startsWith("owned-"),
    },
    batchSize: 2,
  }
}

function runReconciliation(options: TestReconciliationOptions) {
  return options.service.withExclusiveWriteLease((lease) => reconcileIndexer({ ...options, lease }))
}

const emptyRegistry: FieldPolicyRegistry = {
  policies: [],
  byPath: new Map(),
  resolve: () => undefined,
}

function document(id: string): IndexerDocument {
  return { id, fields: { title: id } }
}

interface FakeAdapterOptions {
  withAdmin?: boolean
  failUpsertCalls?: number[]
  failDeleteCalls?: number[]
  failDropCalls?: number[]
  onScanStart?: () => Promise<void>
}

function createFakeAdapter(
  initial: ReadonlyArray<readonly [IndexerSlice, ReadonlyArray<IndexerDocument>]>,
  options: FakeAdapterOptions = {},
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

  const events: string[] = []
  const deleted: Array<[IndexerSlice, string[]]> = []
  const dropped: IndexerSlice[] = []
  const failUpsertCalls = new Set(options.failUpsertCalls ?? [])
  const failDeleteCalls = new Set(options.failDeleteCalls ?? [])
  const failDropCalls = new Set(options.failDropCalls ?? [])
  let upsertCall = 0
  let deleteCall = 0
  let dropCall = 0
  let scanActive = false

  const ensureCollection = vi.fn<IndexerAdapter["ensureCollection"]>(async (slice) => {
    events.push(`ensure:${slice.market}`)
    getOrCreateCollection(collections, slice)
  })
  const upsert = vi.fn<IndexerAdapter["upsert"]>(async (slice, documents) => {
    upsertCall += 1
    if (failUpsertCalls.delete(upsertCall)) throw new Error("temporary upsert failure")
    const collection = collections.get(sliceKey(slice))
    if (!collection) throw new Error(`upsert called before ensureCollection for ${sliceKey(slice)}`)
    events.push(`upsert:${documents.map(({ id }) => id).join(",")}`)
    for (const indexedDocument of documents) {
      collection.documents.set(indexedDocument.id, indexedDocument)
    }
  })
  const bulkReindex = vi.fn<IndexerAdapter["bulkReindex"]>(async () => undefined)
  const list = vi.fn(async () => [...collections.values()].map(({ slice }) => slice))
  const drop = vi.fn(async (slice: IndexerSlice) => {
    dropCall += 1
    if (failDropCalls.delete(dropCall)) throw new Error("temporary drop failure")
    const removed = collections.delete(sliceKey(slice))
    if (removed) dropped.push(slice)
    return removed
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
    ...(options.withAdmin === false
      ? {}
      : {
          admin: {
            list,
            drop,
            async *scan(slice: IndexerSlice) {
              scanActive = true
              try {
                await options.onScanStart?.()
                const collection = collections.get(sliceKey(slice))
                for (const indexedDocument of collection?.documents.values() ?? []) {
                  yield indexedDocument
                }
              } finally {
                scanActive = false
              }
            },
          },
        }),
    ensureCollection,
    upsert,
    async delete(slice, ids) {
      if (scanActive) throw new Error("delete called while admin scan was active")
      deleteCall += 1
      if (failDeleteCalls.delete(deleteCall)) throw new Error("temporary delete failure")
      events.push(`delete:${ids.join(",")}`)
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
    ensureCollection,
    upsert,
    bulkReindex,
    list,
    events,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
