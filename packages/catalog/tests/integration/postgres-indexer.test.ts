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
})
