/**
 * Real-Postgres coverage for the first-party Postgres indexer.
 *
 * Skips locally unless TEST_DATABASE_URL points at a reachable Postgres
 * instance. The adapter creates its own rebuildable projection table and the
 * conformance suite removes every fixture slice after the run.
 */

import {
  assertIndexerAdapterConformance,
  createIndexerConformanceRegistry,
} from "@voyant-travel/catalog-contracts/indexer/conformance"
import type { IndexerSlice } from "@voyant-travel/catalog-contracts/indexer/contract"
import { createTestDb } from "@voyant-travel/db/test-utils"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeAll, describe, expect, it } from "vitest"

import { createPostgresIndexer } from "../../src/indexer/postgres.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let databaseAvailable = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    databaseAvailable = true
  } catch {
    databaseAvailable = false
  }
}

describe.skipIf(!databaseAvailable)("Postgres catalog indexer integration", () => {
  let db: PostgresJsDatabase
  const slice: IndexerSlice = {
    vertical: "postgres-conformance",
    locale: "en-GB",
    audience: "customer",
    market: `conformance-${Date.now()}`,
  }

  beforeAll(() => {
    db = createTestDb()
  })

  it("passes the published adapter conformance suite against Postgres", async () => {
    const registry = createIndexerConformanceRegistry()
    await assertIndexerAdapterConformance({
      createAdapter: () =>
        createPostgresIndexer({
          db,
          registries: new Map([[slice.vertical, registry]]),
        }),
      namespace: `postgres-${Date.now()}`,
      registry,
      slice,
    })
  })

  it("uses native FTS rank before applying the bounded candidate set", async () => {
    const registry = createIndexerConformanceRegistry()
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[slice.vertical, registry]]),
    })
    await adapter.ensureCollection(slice, registry)
    await adapter.upsert(slice, [
      { id: "single-match", fields: { title: "Alpine escape" } },
      { id: "strong-match", fields: { title: "Alpine Alpine Alpine escape" } },
    ])

    try {
      const results = await adapter.search(slice, { mode: "keyword", query: "Alpine" })
      expect(results.hits.map(({ id }) => id)).toEqual(["strong-match", "single-match"])
      expect(results.hits[0]!.score).toBeGreaterThan(results.hits[1]!.score)
    } finally {
      await adapter.admin!.drop(slice)
    }
  })

  it("finds plain-text prefix queries through the native FTS index", async () => {
    const registry = createIndexerConformanceRegistry()
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[slice.vertical, registry]]),
    })
    await adapter.ensureCollection(slice, registry)
    await adapter.upsert(slice, [
      { id: "alpine", fields: { title: "Alpine escape" } },
      { id: "coastal", fields: { title: "Coastal escape" } },
    ])

    try {
      const results = await adapter.search(slice, { mode: "keyword", query: "Alp" })
      expect(results.hits.map(({ id }) => id)).toEqual(["alpine"])
    } finally {
      await adapter.admin!.drop(slice)
    }
  })

  it("prefilters numeric and boolean constraints through typed facet values", async () => {
    const registry = createIndexerConformanceRegistry()
    const filterSlice: IndexerSlice = {
      ...slice,
      market: `typed-facets-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[filterSlice.vertical, registry]]),
    })
    await adapter.ensureCollection(filterSlice, registry)
    await adapter.upsert(filterSlice, [
      {
        id: "in-range",
        fields: { published: true, title: "Island holiday", price: 420 },
      },
      {
        id: "out-of-range",
        fields: { published: true, title: "Island holiday", price: 900 },
      },
      {
        id: "unpublished",
        fields: { published: false, title: "Island holiday", price: 300 },
      },
    ])

    try {
      const results = await adapter.search(filterSlice, {
        filters: [
          { field: "price", gte: 200, kind: "range", lte: 500 },
          { field: "published", kind: "eq", value: true },
        ],
        mode: "keyword",
        query: "Island",
      })
      expect(results.hits.map(({ id }) => id)).toEqual(["in-range"])
    } finally {
      await adapter.admin!.drop(filterSlice)
    }
  })

  it("aggregates exact facets beyond the bounded candidate page", async () => {
    const registry = createIndexerConformanceRegistry()
    const facetSlice: IndexerSlice = {
      ...slice,
      market: `exact-facets-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[facetSlice.vertical, registry]]),
    })
    await adapter.ensureCollection(facetSlice, registry)
    const documentCount = 10_002

    try {
      await adapter.bulkReindex(
        facetSlice,
        toAsyncIterable(
          Array.from({ length: documentCount }, (_, index) => ({
            id: `browse-${index}`,
            fields: { bucket: index < 7_000 ? "coast" : "mountain", title: "Browse result" },
          })),
        ),
      )
      const results = await adapter.search(facetSlice, {
        facets: [{ field: "bucket" }],
        mode: "keyword",
        query: "",
      })
      expect(results.totalRelation).toBe("gte")
      expect(results.facets).toEqual({
        bucket: [
          { count: 7_000, value: "coast" },
          { count: 3_002, value: "mountain" },
        ],
      })
    } finally {
      await adapter.admin!.drop(facetSlice)
    }
  }, 20_000)

  it("aggregates federated facets across every requested audience", async () => {
    const registry = createIndexerConformanceRegistry()
    const market = `federated-facets-${Date.now()}`
    const adminSlice: IndexerSlice = { ...slice, audience: "staff-admin", market }
    const customerSlice: IndexerSlice = { ...slice, audience: "customer", market }
    const partnerSlice: IndexerSlice = { ...slice, audience: "partner", market }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[adminSlice.vertical, registry]]),
    })
    await adapter.ensureCollection(adminSlice, registry)
    await adapter.ensureCollection(customerSlice, registry)
    await adapter.ensureCollection(partnerSlice, registry)
    await adapter.upsert(customerSlice, [
      { id: "customer", fields: { audienceBucket: "customer", title: "Island break" } },
    ])
    await adapter.upsert(partnerSlice, [
      { id: "partner", fields: { audienceBucket: "partner", title: "Island break" } },
    ])

    try {
      const results = await adapter.search(adminSlice, {
        facets: [{ field: "audienceBucket" }],
        mode: "keyword",
        query: "Island",
        search_audiences: ["customer", "partner"],
      })
      expect(results.facets).toEqual({
        audienceBucket: [
          { count: 1, value: "customer" },
          { count: 1, value: "partner" },
        ],
      })
    } finally {
      await adapter.admin!.drop(adminSlice)
      await adapter.admin!.drop(customerSlice)
      await adapter.admin!.drop(partnerSlice)
    }
  })

  it("rejects tampered and stale opaque keyset cursors", async () => {
    const registry = createIndexerConformanceRegistry()
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[slice.vertical, registry]]),
      cursorSigningKey: "integration-cursor-signing-key",
    })
    await adapter.ensureCollection(slice, registry)
    await adapter.upsert(slice, [
      { id: "first", fields: { title: "Island escape" } },
      { id: "second", fields: { title: "Island holiday" } },
    ])

    try {
      const firstPage = await adapter.search(slice, {
        mode: "keyword",
        query: "Island",
        pagination: { limit: 1 },
      })
      expect(firstPage.next_cursor).toBeDefined()
      await expect(
        adapter.search(slice, {
          mode: "keyword",
          query: "Island",
          pagination: { limit: 1, cursor: `${firstPage.next_cursor}x` },
        }),
      ).rejects.toThrow("Search cursor is invalid")
      await adapter.upsert(slice, [{ id: "third", fields: { title: "Island voyage" } }])
      await expect(
        adapter.search(slice, {
          mode: "keyword",
          query: "Island",
          pagination: { limit: 1, cursor: firstPage.next_cursor },
        }),
      ).rejects.toThrow("Search cursor is stale")
    } finally {
      await adapter.admin!.drop(slice)
    }
  })

  it("publishes bulk rebuilds atomically and preserves the active generation on failure", async () => {
    const registry = createIndexerConformanceRegistry()
    const lifecycleSlice: IndexerSlice = {
      ...slice,
      market: `lifecycle-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[lifecycleSlice.vertical, registry]]),
    })
    await adapter.ensureCollection(lifecycleSlice, registry)
    await adapter.upsert(lifecycleSlice, [{ id: "old", fields: { title: "Old projection" } }])
    const beforeRebuild = await adapter.projectionGeneration(lifecycleSlice)
    expect((await adapter.projectionState(lifecycleSlice)).documentCount).toBe(1)

    await adapter.bulkReindex(
      lifecycleSlice,
      toAsyncIterable([{ id: "new", fields: { title: "New projection" } }]),
    )
    const afterRebuild = await adapter.projectionGeneration(lifecycleSlice)

    try {
      expect((await adapter.search(lifecycleSlice, { mode: "keyword", query: "" })).hits).toEqual([
        expect.objectContaining({ id: "new" }),
      ])
      expect(afterRebuild).toBeGreaterThan(beforeRebuild)
      expect((await adapter.projectionState(lifecycleSlice)).documentCount).toBe(1)

      await expect(
        adapter.bulkReindex(lifecycleSlice, failingStream(), { rebuildRunId: "resume" }),
      ).rejects.toThrow("stream failed")
      expect((await adapter.search(lifecycleSlice, { mode: "keyword", query: "" })).hits).toEqual([
        expect.objectContaining({ id: "new" }),
      ])
      expect(await adapter.projectionGeneration(lifecycleSlice)).toBe(afterRebuild)
      expect((await adapter.projectionState(lifecycleSlice)).stagedDocumentCount).toBe(1)

      await adapter.bulkReindex(
        lifecycleSlice,
        toAsyncIterable([{ id: "resumed", fields: { title: "Resumed projection" } }]),
        { rebuildRunId: "resume" },
      )
      const resumed = await adapter.search(lifecycleSlice, { mode: "keyword", query: "" })
      expect(resumed.hits.map(({ id }) => id)).toEqual(["partial", "resumed"])
      expect((await adapter.projectionState(lifecycleSlice)).stagedDocumentCount).toBe(0)

      expect(await adapter.rollbackProjection(lifecycleSlice)).toBe(true)
      expect((await adapter.search(lifecycleSlice, { mode: "keyword", query: "" })).hits).toEqual([
        expect.objectContaining({ id: "new" }),
      ])
      expect(await adapter.projectionGeneration(lifecycleSlice)).toBeGreaterThan(afterRebuild)
      expect(await adapter.rollbackProjection(lifecycleSlice)).toBe(false)
    } finally {
      await adapter.admin!.drop(lifecycleSlice)
    }
  })

  it("does not publish staged documents from a different rebuild snapshot", async () => {
    const registry = createIndexerConformanceRegistry()
    const rebuildSlice: IndexerSlice = {
      ...slice,
      market: `rebuild-snapshot-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[rebuildSlice.vertical, registry]]),
    })
    await adapter.ensureCollection(rebuildSlice, registry)

    try {
      await expect(
        adapter.bulkReindex(rebuildSlice, failingStream(), { rebuildRunId: "stale-source" }),
      ).rejects.toThrow("stream failed")
      expect((await adapter.projectionState(rebuildSlice)).stagedDocumentCount).toBe(1)

      await adapter.bulkReindex(
        rebuildSlice,
        toAsyncIterable([{ id: "current", fields: { title: "Current projection" } }]),
        { rebuildRunId: "current-source" },
      )
      expect((await adapter.search(rebuildSlice, { mode: "keyword", query: "" })).hits).toEqual([
        expect.objectContaining({ id: "current" }),
      ])
      expect((await adapter.projectionState(rebuildSlice)).stagedDocumentCount).toBe(0)
    } finally {
      await adapter.admin!.drop(rebuildSlice)
    }
  })

  it("rolls a successful rebuild back to an empty predecessor", async () => {
    const registry = createIndexerConformanceRegistry()
    const emptySlice: IndexerSlice = {
      ...slice,
      market: `empty-rollback-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[emptySlice.vertical, registry]]),
    })
    await adapter.ensureCollection(emptySlice, registry)

    try {
      await adapter.bulkReindex(
        emptySlice,
        toAsyncIterable([{ id: "new", fields: { title: "New projection" } }]),
      )
      expect(await adapter.rollbackProjection(emptySlice)).toBe(true)
      expect(await adapter.search(emptySlice, { mode: "keyword", query: "" })).toMatchObject({
        hits: [],
        total: 0,
      })
    } finally {
      await adapter.admin!.drop(emptySlice)
    }
  })
})

async function* toAsyncIterable(documents: Array<{ id: string; fields: Record<string, unknown> }>) {
  for (const document of documents) yield document
}

async function* failingStream() {
  yield { id: "partial", fields: { title: "Partial projection" } }
  throw new Error("stream failed")
}
