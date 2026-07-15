import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { db } from "../../src/middleware/db.js"
import { metrics, withQueryCounting } from "../../src/middleware/metrics.js"
import type { DbFactory, VoyantDb } from "../../src/types.js"

function fakeDataset() {
  const points: Array<{ blobs?: string[]; doubles?: number[]; indexes?: string[] }> = []
  return {
    points,
    writeDataPoint: vi.fn((point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => {
      points.push(point)
    }),
  }
}

interface QueryCountingFakeDb {
  select: () => { rows: never[] }
  execute: () => Promise<never[]>
}

function voyantDb(value: QueryCountingFakeDb): VoyantDb {
  return value as VoyantDb
}

describe("metrics middleware", () => {
  it("writes one data point per request with method/route/surface/duration/status", async () => {
    const dataset = fakeDataset()
    const app = new Hono()
    app.use("*", metrics({ dataset: () => dataset }))
    app.get("/v1/public/products/:id", (c) => c.json({ ok: true }))

    const res = await app.request("/v1/public/products/prod_1", {}, { METRICS: dataset })

    expect(res.status).toBe(200)
    expect(dataset.writeDataPoint).toHaveBeenCalledOnce()
    const point = dataset.points[0]
    expect(point?.blobs?.[0]).toBe("GET")
    expect(point?.blobs?.[1]).toBe("/v1/public/products/:id")
    expect(point?.blobs?.[2]).toBe("public")
    expect(point?.doubles?.[1]).toBe(200)
    expect(point?.indexes?.[0]).toBe("/v1/public/products/:id")
  })

  it("is a no-op when the configured sink is unavailable", async () => {
    const app = new Hono()
    app.use("*", metrics({ dataset: () => undefined }))
    app.get("/x", (c) => c.json({ ok: true }))

    const res = await app.request("/x", {}, {})

    expect(res.status).toBe(200)
  })

  it("records the in-worker cache status blob", async () => {
    const dataset = fakeDataset()
    const app = new Hono()
    app.use("*", metrics({ dataset: () => dataset }))
    app.get("/v1/public/things", (c) => {
      c.header("x-voyant-cache", "hit")
      return c.json({ ok: true })
    })

    await app.request("/v1/public/things", {}, { METRICS: dataset })

    expect(dataset.points[0]?.blobs?.[3]).toBe("hit")
  })

  it("still writes the point when the handler throws", async () => {
    const dataset = fakeDataset()
    const app = new Hono()
    app.onError((_err, c) => c.json({ error: true }, 500))
    app.use("*", metrics({ dataset: () => dataset }))
    app.get("/boom", () => {
      throw new Error("boom")
    })

    const res = await app.request("/boom", {}, { METRICS: dataset })

    expect(res.status).toBe(500)
    expect(dataset.writeDataPoint).toHaveBeenCalledOnce()
  })

  it("counts db queries issued through the db middleware", async () => {
    const dataset = fakeDataset()
    const fakeDb = voyantDb({
      select: () => ({ rows: [] }),
      execute: async () => [],
    })
    const fakeDbFactory: DbFactory = () => fakeDb
    const app = new Hono()
    app.use("*", metrics({ dataset: () => dataset }))
    app.use("*", db(fakeDbFactory))
    app.get("/v1/admin/things", async (c) => {
      const handle = c.get("db") as {
        select: () => unknown
        execute: () => Promise<unknown>
      }
      handle.select()
      handle.select()
      await handle.execute()
      return c.json({ ok: true })
    })

    await app.request("/v1/admin/things", {}, { METRICS: dataset })

    expect(dataset.points[0]?.doubles?.[2]).toBe(3)
  })
})

describe("withQueryCounting", () => {
  it("counts query-initiating calls and passes results through", () => {
    const counter = { queries: 0 }
    const target = {
      select: vi.fn(() => "builder"),
      transaction: vi.fn(async () => "tx-result"),
      somethingElse: vi.fn(() => "other"),
      flag: true,
    }
    const wrapped = withQueryCounting(target, counter)

    expect(wrapped.select()).toBe("builder")
    expect(wrapped.somethingElse()).toBe("other")
    expect(wrapped.flag).toBe(true)

    expect(counter.queries).toBe(1)
  })

  it("counts a transaction as one query", async () => {
    const counter = { queries: 0 }
    const target = { transaction: vi.fn(async () => "done") }
    const wrapped = withQueryCounting(target, counter)

    await wrapped.transaction()

    expect(counter.queries).toBe(1)
  })
})
