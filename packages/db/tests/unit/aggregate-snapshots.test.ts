import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  aggregateSnapshotKey,
  readThroughAggregateSnapshot,
} from "../../src/aggregate-snapshots.js"

interface SnapshotRow {
  key: string
  payload: unknown
  computedAt: Date
  staleAfter: Date
}

/**
 * Minimal chainable stub for the two drizzle call shapes the helper uses:
 * `db.select().from().where().limit()` and
 * `db.insert().values().onConflictDoUpdate()`. Each test exercises a single
 * key, so the stub keeps at most one row and ignores the where clause.
 */
function createStubDb(initialRow?: SnapshotRow) {
  let row: SnapshotRow | undefined = initialRow
  const counters = { selects: 0, upserts: 0 }
  const failures = { select: false, upsert: false }

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            counters.selects += 1
            if (failures.select) throw new Error("select failed")
            return row ? [row] : []
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: SnapshotRow) => ({
        onConflictDoUpdate: async () => {
          counters.upserts += 1
          if (failures.upsert) throw new Error("upsert failed")
          row = { ...values }
        },
      }),
    }),
  } as unknown as PostgresJsDatabase

  return {
    db,
    counters,
    failures,
    getRow: () => row,
    setRow: (next: SnapshotRow | undefined) => {
      row = next
    },
  }
}

describe("readThroughAggregateSnapshot", () => {
  it("computes, stores, and returns on a cold miss", async () => {
    const stub = createStubDb()
    const compute = vi.fn(async () => ({ total: 42 }))

    const result = await readThroughAggregateSnapshot(stub.db, {
      key: "bookings:aggregates:test",
      ttlSeconds: 60,
      compute,
    })

    expect(result.data).toEqual({ total: 42 })
    expect(result.fromSnapshot).toBe(false)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(stub.counters.upserts).toBe(1)

    const stored = stub.getRow()
    expect(stored?.key).toBe("bookings:aggregates:test")
    expect(stored?.payload).toEqual({ total: 42 })
    expect(stored?.staleAfter.getTime()).toBe((stored?.computedAt.getTime() ?? 0) + 60_000)
  })

  it("serves a fresh snapshot without recomputing", async () => {
    const computedAt = new Date()
    const stub = createStubDb({
      key: "bookings:aggregates:test",
      payload: { total: 7 },
      computedAt,
      staleAfter: new Date(computedAt.getTime() + 60_000),
    })
    const compute = vi.fn(async () => ({ total: 999 }))

    const result = await readThroughAggregateSnapshot<{ total: number }>(stub.db, {
      key: "bookings:aggregates:test",
      ttlSeconds: 60,
      compute,
    })

    expect(result.data).toEqual({ total: 7 })
    expect(result.fromSnapshot).toBe(true)
    expect(result.computedAt).toEqual(computedAt)
    expect(compute).not.toHaveBeenCalled()
    expect(stub.counters.upserts).toBe(0)
  })

  it("recomputes and overwrites a stale snapshot", async () => {
    const past = new Date(Date.now() - 120_000)
    const stub = createStubDb({
      key: "bookings:aggregates:test",
      payload: { total: 7 },
      computedAt: past,
      staleAfter: new Date(past.getTime() + 60_000),
    })
    const compute = vi.fn(async () => ({ total: 8 }))

    const result = await readThroughAggregateSnapshot(stub.db, {
      key: "bookings:aggregates:test",
      ttlSeconds: 60,
      compute,
    })

    expect(result.data).toEqual({ total: 8 })
    expect(result.fromSnapshot).toBe(false)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(stub.counters.upserts).toBe(1)
    expect(stub.getRow()?.payload).toEqual({ total: 8 })
  })

  it("treats a row exactly at staleAfter as stale", async () => {
    const computedAt = new Date("2026-01-01T00:00:00Z")
    const staleAfter = new Date("2026-01-01T00:01:00Z")
    const stub = createStubDb({
      key: "k",
      payload: { total: 1 },
      computedAt,
      staleAfter,
    })
    const compute = vi.fn(async () => ({ total: 2 }))

    const result = await readThroughAggregateSnapshot(stub.db, {
      key: "k",
      ttlSeconds: 60,
      compute,
      now: () => staleAfter,
    })

    expect(result.fromSnapshot).toBe(false)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it("returns computed data when the upsert fails (best-effort cache)", async () => {
    const stub = createStubDb()
    stub.failures.upsert = true
    const compute = vi.fn(async () => ({ total: 3 }))

    const result = await readThroughAggregateSnapshot(stub.db, {
      key: "k",
      ttlSeconds: 60,
      compute,
    })

    expect(result.data).toEqual({ total: 3 })
    expect(result.fromSnapshot).toBe(false)
    expect(stub.getRow()).toBeUndefined()
  })

  it("falls back to compute when the snapshot read fails (e.g. table missing)", async () => {
    const stub = createStubDb()
    stub.failures.select = true
    const compute = vi.fn(async () => ({ total: 4 }))

    const result = await readThroughAggregateSnapshot(stub.db, {
      key: "k",
      ttlSeconds: 60,
      compute,
    })

    expect(result.data).toEqual({ total: 4 })
    expect(result.fromSnapshot).toBe(false)
    expect(compute).toHaveBeenCalledTimes(1)
  })
})

describe("aggregateSnapshotKey", () => {
  it("joins string/number parts with ':' and skips nullish parts", () => {
    expect(aggregateSnapshotKey("finance", "aggregates", undefined, null, 5)).toBe(
      "finance:aggregates:5",
    )
  })

  it("renders object params order-stably and drops undefined values", () => {
    const a = aggregateSnapshotKey("bookings", { from: "2026-01-01", to: "2026-02-01" })
    const b = aggregateSnapshotKey("bookings", {
      to: "2026-02-01",
      from: "2026-01-01",
      extra: undefined,
    })
    expect(a).toBe(b)
    expect(a).toBe('bookings:{"from":"2026-01-01","to":"2026-02-01"}')
  })

  it("hashes long parts deterministically", () => {
    const longParams = {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T23:59:59.999Z",
      currency: ["EUR", "USD", "GBP"],
      status: ["issued", "paid", "overdue"],
    }
    const a = aggregateSnapshotKey("finance", "aggregates", longParams)
    const b = aggregateSnapshotKey("finance", "aggregates", { ...longParams })
    expect(a).toBe(b)
    // Long param part is replaced by a 16-hex-char FNV-1a 64 digest.
    expect(a).toMatch(/^finance:aggregates:[0-9a-f]{16}$/)
  })

  it("produces different hashes for different long params", () => {
    const base = { padding: "x".repeat(64) }
    const a = aggregateSnapshotKey("s", { ...base, n: 1 })
    const b = aggregateSnapshotKey("s", { ...base, n: 2 })
    expect(a).not.toBe(b)
  })
})
