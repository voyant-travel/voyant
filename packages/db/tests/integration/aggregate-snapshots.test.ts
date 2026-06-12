/**
 * DB-gated integration coverage for the read-through aggregate snapshot
 * helper — exercises the real `INSERT ... ON CONFLICT (key) DO UPDATE`
 * upsert path against Postgres. The `aggregate_snapshots` table does not
 * exist in the test database yet (the combined migration ships later), so
 * the table is created ephemerally in beforeAll and dropped in afterAll,
 * following the crud.test.ts pattern.
 */

import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { readThroughAggregateSnapshot } from "../../src/aggregate-snapshots.js"
import { aggregateSnapshots } from "../../src/schema/aggregate-snapshots.js"
import { createTestDb } from "../../src/test-utils.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

describe.skipIf(!DB_AVAILABLE)("readThroughAggregateSnapshot (integration)", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    db = createTestDb()
    await db.execute(sql`DROP TABLE IF EXISTS aggregate_snapshots`)
    await db.execute(sql`
      CREATE TABLE aggregate_snapshots (
        key text PRIMARY KEY,
        payload jsonb NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now(),
        stale_after timestamptz NOT NULL
      )
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS aggregate_snapshots`)
  })

  afterEach(async () => {
    await db.execute(sql`TRUNCATE aggregate_snapshots`)
  })

  it("cold call computes and inserts; warm call within TTL reads the row back", async () => {
    const compute = vi.fn(async () => ({ total: 11, buckets: [{ status: "confirmed", n: 4 }] }))

    const cold = await readThroughAggregateSnapshot(db, {
      key: "it:aggregates:a",
      ttlSeconds: 60,
      compute,
    })
    expect(cold.fromSnapshot).toBe(false)
    expect(compute).toHaveBeenCalledTimes(1)

    const warm = await readThroughAggregateSnapshot(db, {
      key: "it:aggregates:a",
      ttlSeconds: 60,
      compute,
    })
    expect(warm.fromSnapshot).toBe(true)
    expect(warm.data).toEqual({ total: 11, buckets: [{ status: "confirmed", n: 4 }] })
    expect(compute).toHaveBeenCalledTimes(1)

    const rows = await db.select().from(aggregateSnapshots)
    expect(rows).toHaveLength(1)
  })

  it("stale row is recomputed and updated in place via ON CONFLICT (single row, no duplicates)", async () => {
    let version = 0
    const compute = vi.fn(async () => {
      version += 1
      return { version }
    })

    await readThroughAggregateSnapshot(db, { key: "it:aggregates:b", ttlSeconds: 60, compute })

    // Force staleness without waiting out the TTL.
    await db.execute(sql`UPDATE aggregate_snapshots SET stale_after = now() - interval '1 second'`)

    const refreshed = await readThroughAggregateSnapshot(db, {
      key: "it:aggregates:b",
      ttlSeconds: 60,
      compute,
    })
    expect(refreshed.fromSnapshot).toBe(false)
    expect(refreshed.data).toEqual({ version: 2 })
    expect(compute).toHaveBeenCalledTimes(2)

    const rows = await db.select().from(aggregateSnapshots)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.payload).toEqual({ version: 2 })
    expect(rows[0]?.staleAfter.getTime()).toBeGreaterThan(Date.now())
  })

  it("distinct keys keep distinct snapshots", async () => {
    await readThroughAggregateSnapshot(db, {
      key: "it:aggregates:left",
      ttlSeconds: 60,
      compute: async () => ({ side: "left" }),
    })
    await readThroughAggregateSnapshot(db, {
      key: "it:aggregates:right",
      ttlSeconds: 60,
      compute: async () => ({ side: "right" }),
    })

    const rows = await db.select().from(aggregateSnapshots)
    expect(rows).toHaveLength(2)
  })
})
