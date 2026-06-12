import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { sha256Base64Url } from "../../src/auth/crypto.js"
import { requireAuth } from "../../src/middleware/auth.js"

const TOKEN = "voy_cache_test_key"

function makeApiKeyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "key_123",
    configId: "default",
    name: "Automation",
    start: "voy_ca",
    prefix: "voy_",
    key: "hash",
    referenceId: "user_123",
    refillInterval: null,
    refillAmount: null,
    lastRefillAt: null,
    enabled: true,
    rateLimitEnabled: false,
    rateLimitTimeWindow: null,
    rateLimitMax: null,
    requestCount: 0,
    remaining: null,
    lastRequest: null,
    createdAt: new Date("2026-05-16T00:00:00.000Z"),
    updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    expiresAt: null,
    permissions: JSON.stringify({ "*": ["*"] }),
    metadata: null,
    ...overrides,
  }
}

/** Tracks SELECT executions so cache hits are observable. */
function makeCountingDb(row: Record<string, unknown>) {
  const selects = vi.fn()
  const db = {
    select: () => {
      selects()
      return {
        from: () => ({
          where: () => ({
            limit: async () => [row],
          }),
        }),
      }
    },
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  }
  return { db: db as never, selects }
}

function makeKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async <T = string>(key: string, options?: { type?: "json" | "text" }) => {
      const value = store.get(key)
      if (value === undefined) return null
      return (options?.type === "json" ? JSON.parse(value) : value) as T | null
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async () => {}),
  }
}

function mockExecutionCtx() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: {
      waitUntil(p: Promise<unknown>) {
        pending.push(p)
      },
      passThroughOnException() {},
    },
    flush: () => Promise.all(pending),
  }
}

function buildApp(db: never) {
  const app = new Hono()
  app.use(
    "*",
    requireAuth(() => db),
  )
  app.get("/secure", (c) => c.json({ ok: true }))
  return app
}

describe("requireAuth API-key KV cache", () => {
  it("serves the second request from KV without a DB select (quota-less key)", async () => {
    const row = makeApiKeyRow({ key: await sha256Base64Url(TOKEN) })
    const { db, selects } = makeCountingDb(row)
    const kv = makeKv()
    const env = { DATABASE_URL: "postgres://test", CACHE: kv }
    const app = buildApp(db)

    const first = mockExecutionCtx()
    const res1 = await app.fetch(
      new Request("http://x.local/secure", { headers: { Authorization: `Bearer ${TOKEN}` } }),
      env,
      first.ctx as never,
    )
    expect(res1.status).toBe(200)
    expect(selects).toHaveBeenCalledTimes(1)
    await first.flush()
    expect(kv.put).toHaveBeenCalledOnce()

    const second = mockExecutionCtx()
    const res2 = await app.fetch(
      new Request("http://x.local/secure", { headers: { Authorization: `Bearer ${TOKEN}` } }),
      env,
      second.ctx as never,
    )
    expect(res2.status).toBe(200)
    // Still exactly one DB select — the second request hit KV.
    expect(selects).toHaveBeenCalledTimes(1)
  })

  it("never caches quota-limited keys", async () => {
    const row = makeApiKeyRow({ key: await sha256Base64Url(TOKEN), remaining: 5 })
    const { db, selects } = makeCountingDb(row)
    const kv = makeKv()
    const env = { DATABASE_URL: "postgres://test", CACHE: kv }
    const app = buildApp(db)

    for (let i = 0; i < 2; i++) {
      const { ctx, flush } = mockExecutionCtx()
      const res = await app.fetch(
        new Request("http://x.local/secure", { headers: { Authorization: `Bearer ${TOKEN}` } }),
        env,
        ctx as never,
      )
      expect(res.status).toBe(200)
      await flush()
    }

    expect(kv.put).not.toHaveBeenCalled()
    expect(selects).toHaveBeenCalledTimes(2)
  })

  it("revives date fields from the cached entry (expiry check still works)", async () => {
    const expired = makeApiKeyRow({
      key: await sha256Base64Url(TOKEN),
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    })
    const kv = makeKv()
    // Pre-seed the cache as if a previous request stored the (now
    // expired) row.
    kv.store.set(`apikey:v1:${await sha256Base64Url(TOKEN)}`, JSON.stringify(expired))
    const { db, selects } = makeCountingDb(expired)
    const env = { DATABASE_URL: "postgres://test", CACHE: kv }
    const app = buildApp(db)

    const { ctx } = mockExecutionCtx()
    const res = await app.fetch(
      new Request("http://x.local/secure", { headers: { Authorization: `Bearer ${TOKEN}` } }),
      env,
      ctx as never,
    )

    // Date revived from ISO string and compared correctly → 401, no DB hit.
    expect(res.status).toBe(401)
    expect(selects).not.toHaveBeenCalled()
  })

  it("works without a CACHE binding (straight to DB)", async () => {
    const row = makeApiKeyRow({ key: await sha256Base64Url(TOKEN) })
    const { db, selects } = makeCountingDb(row)
    const env = { DATABASE_URL: "postgres://test" }
    const app = buildApp(db)

    const { ctx } = mockExecutionCtx()
    const res = await app.fetch(
      new Request("http://x.local/secure", { headers: { Authorization: `Bearer ${TOKEN}` } }),
      env,
      ctx as never,
    )

    expect(res.status).toBe(200)
    expect(selects).toHaveBeenCalledTimes(1)
  })
})
