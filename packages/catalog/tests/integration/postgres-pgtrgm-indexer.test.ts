/**
 * Real pg_trgm coverage for the recorded native Postgres typo strategy.
 *
 * The adapter requires the extension to be provisioned by the deployment;
 * this disposable test database prepares it before creating the adapter.
 */

import type { IndexerSlice } from "@voyant-travel/catalog-contracts/indexer/contract"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeAll, describe, expect, it } from "vitest"

import { createPostgresIndexer } from "../../src/indexer/postgres.js"
import { runTravelRelevance, travelRelevanceCorpus } from "../../src/indexer/relevance.js"

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

describe.skipIf(!databaseAvailable)("Postgres pg_trgm catalog indexer integration", () => {
  let db: PostgresJsDatabase
  const slice: IndexerSlice = {
    vertical: "postgres-pgtrgm",
    locale: "en-GB",
    audience: "customer",
    market: `pgtrgm-${Date.now()}`,
  }

  beforeAll(async () => {
    db = createTestDb()
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  })

  it("recovers an eligible typo after native FTS finds no result", async () => {
    const adapter = createPostgresIndexer({
      db,
      registries: new Map(),
      typoStrategy: "pgtrgm",
    })
    await adapter.ensureCollection(slice)
    await adapter.upsert(slice, [
      { id: "santorini", fields: { title: "Santorini escape" } },
      { id: "crete", fields: { title: "Crete escape" } },
    ])

    try {
      const results = await adapter.search(slice, { mode: "keyword", query: "Santoriny" })
      expect(results.hits.map(({ id }) => id)).toEqual(["santorini"])
      expect(adapter.diagnostics().typoStrategy).toBe("pgtrgm")
    } finally {
      await adapter.admin!.drop(slice)
    }
  })

  it("meets the curated travel relevance assertions with native fallbacks", async () => {
    const relevanceSlice: IndexerSlice = {
      ...slice,
      market: `relevance-${Date.now()}`,
    }
    const adapter = createPostgresIndexer({
      db,
      registries: new Map(),
      typoStrategy: "pgtrgm",
    })
    await adapter.ensureCollection(relevanceSlice)
    await adapter.upsert(relevanceSlice, [...travelRelevanceCorpus.documents])

    try {
      const report = await runTravelRelevance(adapter, relevanceSlice, travelRelevanceCorpus.cases)
      expect(report.metrics).toEqual({
        ndcgAtK: 1,
        recallAtK: 1,
        zeroResultRate: 0,
      })
    } finally {
      await adapter.admin!.drop(relevanceSlice)
    }
  })
})
