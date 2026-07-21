/**
 * Real pgvector coverage for the recorded native Postgres vector strategy.
 *
 * The production adapter never creates extensions. This disposable test
 * database provisions pgvector before exercising the public conformance suite.
 */

import {
  assertIndexerAdapterConformance,
  createIndexerConformanceRegistry,
} from "@voyant-travel/catalog-contracts/indexer/conformance"
import type { IndexerSlice } from "@voyant-travel/catalog-contracts/indexer/contract"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { sql } from "drizzle-orm"
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

describe.skipIf(!databaseAvailable)("Postgres pgvector catalog indexer integration", () => {
  let db: PostgresJsDatabase
  const slice: IndexerSlice = {
    vertical: "postgres-pgvector-conformance",
    locale: "en-GB",
    audience: "customer",
    market: `conformance-${Date.now()}`,
  }

  beforeAll(async () => {
    db = createTestDb()
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
  })

  it("passes public vector and hybrid conformance against pgvector", async () => {
    const registry = createIndexerConformanceRegistry()
    await assertIndexerAdapterConformance({
      createAdapter: () =>
        createPostgresIndexer({
          db,
          registries: new Map([[slice.vertical, registry]]),
          vectorStrategy: "pgvector",
          vectorDimensions: 3,
        }),
      namespace: `postgres-pgvector-${Date.now()}`,
      registry,
      slice,
    })
  })

  it("applies model isolation and a cosine distance threshold natively", async () => {
    const registry = createIndexerConformanceRegistry()
    const adapter = createPostgresIndexer({
      db,
      registries: new Map([[slice.vertical, registry]]),
      vectorStrategy: "pgvector",
      vectorDimensions: 3,
    })
    await adapter.ensureCollection(slice, registry)
    await adapter.upsert(slice, [
      {
        id: "model-a-near",
        fields: { title: "Model A near" },
        embeddings: { text: [1, 0, 0] },
        embedding_model_id: "model-a",
      },
      {
        id: "model-a-far",
        fields: { title: "Model A far" },
        embeddings: { text: [-1, 0, 0] },
        embedding_model_id: "model-a",
      },
      {
        id: "model-b-near",
        fields: { title: "Model B near" },
        embeddings: { text: [1, 0, 0] },
        embedding_model_id: "model-b",
      },
    ])

    try {
      const results = await adapter.search(slice, {
        mode: "semantic",
        query: "near",
        query_embedding: [1, 0, 0],
        query_embedding_model_id: "model-a",
        distance_threshold: 0.1,
      })
      expect(results.hits.map(({ id }) => id)).toEqual(["model-a-near"])
    } finally {
      await adapter.admin!.drop(slice)
    }
  })
})
