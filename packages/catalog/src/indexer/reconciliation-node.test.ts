/// <reference types="node" />

import type { createReadStream as CreateReadStream } from "node:fs"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import type { rm as Remove } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
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
  createFileIndexerReconciliationStateStore,
  IndexerAdminUnavailableError,
  type IndexerReconciliationAuthority,
  type IndexerReconciliationExclusiveContext,
  type ReconcileIndexerOptions,
  reconcileIndexer,
} from "./reconciliation-node.js"

const fsControl = vi.hoisted(() => ({
  readPaths: [] as string[],
  failNextRemove: false,
}))

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    createReadStream(...args: Parameters<typeof CreateReadStream>) {
      fsControl.readPaths.push(String(args[0]))
      return actual.createReadStream(...args)
    },
  }
})

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    async rm(...args: Parameters<typeof Remove>) {
      if (fsControl.failNextRemove) {
        fsControl.failNextRemove = false
        throw new Error("temporary remove failure")
      }
      return actual.rm(...args)
    },
  }
})

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
    const fixture = reconciliationFixture(
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

    const result = await reconcileIndexer(fixture.options)

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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ deletedDocuments: 3 })
    expect(fake.deleted.map(([, ids]) => ids.length)).toEqual([2, 1])
    expect(fake.deleted.flatMap(([, ids]) => ids).sort()).toEqual([
      "owned-stale-1",
      "owned-stale-2",
      "owned-stale-3",
    ])
  })

  it("holds live writes behind the caller-owned exclusive authority", async () => {
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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    const reconciliation = reconcileIndexer(fixture.options)
    await scanStarted.promise
    const concurrentWrite = fixture.lock.runMutation(() =>
      fake.adapter.upsert(productsCurrent, [document("owned-concurrent")]),
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
    expect(fixture.lock.exclusiveRuns()).toBe(1)
  })

  it("ensures target collections before upserting", async () => {
    const fake = createFakeAdapter([])
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ indexedDocuments: 1 })
    expect(fake.events.slice(0, 2)).toEqual(["ensure:current", "upsert:owned-live"])
    expect(fake.ids(productsCurrent)).toEqual(["owned-live"])
  })

  it("drops only explicit obsolete owned slice candidates", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [productsObsolete, [document("owned-old")]],
      [unrelatedSlice, [document("foreign-old")]],
    ])
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )
    fixture.options.obsoleteSlices = [productsObsolete]

    const result = await reconcileIndexer(fixture.options)

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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent, productsUntargeted],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )
    fixture.options.obsoleteSlices = [productsObsolete]

    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ droppedSlices: 1 })
    expect(fake.has(productsUntargeted)).toBe(true)
    expect(fake.has(productsObsolete)).toBe(false)
  })

  it("rejects unowned obsolete candidates before mutation", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, []],
      [unrelatedSlice, [document("foreign-old")]],
    ])
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )
    fixture.options.obsoleteSlices = [unrelatedSlice]

    await expect(reconcileIndexer(fixture.options)).rejects.toThrow("does not own obsolete slice")
    expect(fake.ensureCollection).not.toHaveBeenCalled()
    expect(fake.has(unrelatedSlice)).toBe(true)
  })

  it("is idempotent after stale documents and explicit slices are removed", async () => {
    const fake = createFakeAdapter([
      [productsCurrent, [document("owned-live"), document("owned-stale")]],
      [productsObsolete, []],
    ])
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )
    fixture.options.obsoleteSlices = [productsObsolete]

    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({
      deletedDocuments: 1,
      droppedSlices: 1,
    })
    await expect(reconcileIndexer(fixture.options)).resolves.toEqual({
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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments }],
    )
    fixture.options.onMissingAdmin = "upsert-only"

    await expect(reconcileIndexer(fixture.options)).rejects.toThrow("temporary upsert failure")
    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ indexedDocuments: 2 })
    expect(loadDocuments).toHaveBeenCalledTimes(2)
    expect(fake.ids(productsCurrent)).toEqual(["owned-live", "owned-new"])
  })

  it("retries idempotently after one upsert batch succeeds", async () => {
    const fake = createFakeAdapter([], { failUpsertCalls: [2] })
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [
        {
          slice: productsCurrent,
          loadDocuments: () => [document("owned-1"), document("owned-2"), document("owned-3")],
        },
      ],
    )

    await expect(reconcileIndexer(fixture.options)).rejects.toThrow("temporary upsert failure")
    expect(fake.ids(productsCurrent)).toEqual(["owned-1", "owned-2"])
    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ indexedDocuments: 3 })
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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(fixture.options)).rejects.toThrow("temporary delete failure")
    expect(fake.ids(productsCurrent)).toContain("owned-live")
    expect(fake.ids(productsCurrent).filter((id) => id.startsWith("owned-stale-"))).toHaveLength(1)
    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ deletedDocuments: 1 })
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
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [] }],
    )
    fixture.options.obsoleteSlices = [productsObsolete, productsObsoleteSecond]

    await expect(reconcileIndexer(fixture.options)).rejects.toThrow("temporary drop failure")
    expect(fake.has(productsObsolete)).toBe(false)
    expect(fake.has(productsObsoleteSecond)).toBe(true)
    await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({ droppedSlices: 1 })
    expect(fake.has(productsObsoleteSecond)).toBe(false)
  })

  it("keeps filesystem cleanup retryable after a remove failure", async () => {
    const directory = mkdtempSync(join(tmpdir(), "voyant-reconciliation-cleanup-"))
    const store = createFileIndexerReconciliationStateStore({ directory, buckets: 2 })
    try {
      const state = await store.create(productsCurrent)
      await state.writeExpectedIds(["owned-live"])
      await state.seal()

      fsControl.failNextRemove = true
      await expect(state.dispose()).rejects.toThrow("temporary remove failure")
      expect(readdirSync(directory)).toHaveLength(1)
      await expect(state.dispose()).resolves.toBeUndefined()
      expect(readdirSync(directory)).toEqual([])
    } finally {
      fsControl.failNextRemove = false
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("reads each populated spool bucket once for a large reconciliation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "voyant-reconciliation-buckets-"))
    const expected = Array.from({ length: 1_000 }, (_, index) => document(`owned-live-${index}`))
    const stale = Array.from({ length: 1_000 }, (_, index) => document(`owned-stale-${index}`))
    const fake = createFakeAdapter([[productsCurrent, [...expected, ...stale]]])
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => expected }],
    )
    fixture.options.batchSize = 100
    fixture.options.stateStore = createFileIndexerReconciliationStateStore({
      directory,
      buckets: 8,
    })
    fsControl.readPaths.length = 0

    try {
      await expect(reconcileIndexer(fixture.options)).resolves.toMatchObject({
        indexedDocuments: 1_000,
        deletedDocuments: 1_000,
      })
      const bucketReads = fsControl.readPaths
        .filter((path) => path.startsWith(directory))
        .map((path) => basename(path))
      expect(bucketReads).toHaveLength(16)
      expect(new Set(bucketReads).size).toBe(bucketReads.length)
      expect(readdirSync(directory)).toEqual([])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("fails before mutation when the authority adapter has no admin surface", async () => {
    const fake = createFakeAdapter([], { withAdmin: false })
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )

    await expect(reconcileIndexer(fixture.options)).rejects.toBeInstanceOf(
      IndexerAdminUnavailableError,
    )
    expect(fake.ensureCollection).not.toHaveBeenCalled()
    expect(fake.upsert).not.toHaveBeenCalled()
  })

  it("supports explicit non-destructive reconciliation without admin", async () => {
    const fake = createFakeAdapter([[productsCurrent, [document("owned-stale")]]], {
      withAdmin: false,
    })
    const fixture = reconciliationFixture(
      fake,
      [productsCurrent],
      [{ slice: productsCurrent, loadDocuments: () => [document("owned-live")] }],
    )
    fixture.options.onMissingAdmin = "upsert-only"

    await expect(reconcileIndexer(fixture.options)).resolves.toEqual({
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

function reconciliationFixture(
  fake: ReturnType<typeof createFakeAdapter>,
  slices: IndexerSlice[],
  targets: ReconcileIndexerOptions["targets"],
) {
  const lock = createFakeReconciliationAuthority(fake.adapter, slices)
  const options: ReconcileIndexerOptions = {
    authority: lock.authority,
    targets,
    ownership: {
      ownsSlice: (slice) => slice.vertical === "products",
      ownsDocument: (_slice, indexedDocument) => indexedDocument.id.startsWith("owned-"),
    },
    batchSize: 2,
  }
  return { options, lock }
}

function createFakeReconciliationAuthority(
  adapter: IndexerAdapter,
  configuredSlices: IndexerSlice[],
) {
  let tail = Promise.resolve()
  const runLocked = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation)
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
  const context: IndexerReconciliationExclusiveContext = {
    adapter,
    configuredSlices,
    async ensureCollections(slices) {
      const configured = new Set(configuredSlices.map(sliceKey))
      for (const slice of slices) {
        if (!configured.has(sliceKey(slice)))
          throw new Error("attempted to ensure unconfigured slice")
        await adapter.ensureCollection(slice, emptyRegistry)
      }
    },
  }
  let exclusiveRuns = 0
  const authority: IndexerReconciliationAuthority = {
    runExclusive<T>(operation: (context: IndexerReconciliationExclusiveContext) => Promise<T>) {
      exclusiveRuns += 1
      return runLocked(() => operation(context))
    },
  }
  return {
    authority,
    exclusiveRuns: () => exclusiveRuns,
    runMutation: runLocked,
  }
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
