/**
 * GET /aggregates is served through a read-through TTL snapshot (#1629):
 * the first request computes and stores; a second request within the TTL
 * must be answered from the stored snapshot WITHOUT re-running the
 * aggregate fan-out. The db stub only implements the two drizzle call
 * shapes the snapshot helper uses; the aggregate computation itself is
 * spied on `bookingsService` so its underlying queries never run.
 */

import { handleApiError } from "@voyantjs/hono"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { bookingRoutes } from "../../src/routes.js"
import { bookingsService } from "../../src/service.js"

interface SnapshotRow {
  key: string
  payload: unknown
  computedAt: Date
  staleAfter: Date
}

/**
 * Pulls the bound key value out of the drizzle `eq(aggregateSnapshots.key,
 * key)` condition so the stub can be key-aware (param values live in the
 * SQL object's queryChunks as `Param`-like `{ value }` entries).
 */
function extractKeyFromWhere(condition: unknown): string | undefined {
  const chunks = (condition as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? []
  for (const chunk of chunks) {
    if (
      chunk !== null &&
      typeof chunk === "object" &&
      "value" in chunk &&
      typeof (chunk as { value: unknown }).value === "string"
    ) {
      return (chunk as { value: string }).value
    }
  }
  return undefined
}

/** Stub db backing only the aggregate_snapshots read + upsert. */
function createSnapshotStubDb() {
  const rows = new Map<string, SnapshotRow>()
  const counters = { selects: 0, upserts: 0 }
  const upsertedKeys: string[] = []

  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: async () => {
            counters.selects += 1
            const key = extractKeyFromWhere(condition)
            const row = key === undefined ? undefined : rows.get(key)
            return row ? [row] : []
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: SnapshotRow) => ({
        onConflictDoUpdate: async () => {
          counters.upserts += 1
          upsertedKeys.push(values.key)
          rows.set(values.key, { ...values })
        },
      }),
    }),
  }

  return { db, counters, upsertedKeys, rows }
}

function createApp(db: unknown) {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, db as never)
      c.set("userId" as never, "test-user")
      c.set("actor" as never, "staff")
      await next()
    })
    .route("/", bookingRoutes)
}

const fakeAggregates = {
  total: 12,
  totalPax: 31,
  byStatus: [{ status: "confirmed", count: 9 }],
  monthlyCounts: [{ yearMonth: "2026-06", count: 12 }],
  monthlyRevenue: [],
  upcomingDepartures: { count: 3, items: [] },
}

describe("GET /aggregates snapshot read-through", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("computes once, then serves the second call within the TTL from the snapshot", async () => {
    const stub = createSnapshotStubDb()
    const aggregatesSpy = vi
      .spyOn(bookingsService, "getBookingAggregates")
      .mockResolvedValue(fakeAggregates as never)
    const app = createApp(stub.db)

    const first = await app.request("/aggregates")
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ data: fakeAggregates })
    expect(aggregatesSpy).toHaveBeenCalledTimes(1)
    expect(stub.counters.upserts).toBe(1)

    const second = await app.request("/aggregates")
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ data: fakeAggregates })

    // The aggregate fan-out did NOT run again — the snapshot answered.
    expect(aggregatesSpy).toHaveBeenCalledTimes(1)
    expect(stub.counters.upserts).toBe(1)
    expect(stub.counters.selects).toBe(2)
  })

  it("keys the snapshot by query params — different params recompute", async () => {
    const stub = createSnapshotStubDb()
    const aggregatesSpy = vi
      .spyOn(bookingsService, "getBookingAggregates")
      .mockResolvedValue(fakeAggregates as never)
    const app = createApp(stub.db)

    await app.request("/aggregates?from=2026-01-01T00:00:00Z")
    expect(aggregatesSpy).toHaveBeenCalledTimes(1)

    // Different params → different key → snapshot miss → recompute.
    await app.request("/aggregates?from=2026-02-01T00:00:00Z")
    expect(aggregatesSpy).toHaveBeenCalledTimes(2)
    expect(stub.counters.upserts).toBe(2)
    expect(new Set(stub.upsertedKeys).size).toBe(2)

    // Same params again → snapshot hit → still two computes.
    await app.request("/aggregates?from=2026-01-01T00:00:00Z")
    expect(aggregatesSpy).toHaveBeenCalledTimes(2)
  })

  it("sets the dashboard Cache-Control header", async () => {
    const stub = createSnapshotStubDb()
    vi.spyOn(bookingsService, "getBookingAggregates").mockResolvedValue(fakeAggregates as never)
    const app = createApp(stub.db)

    const res = await app.request("/aggregates")
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30")
    expect(res.headers.get("Vary")).toContain("Authorization")
  })
})
