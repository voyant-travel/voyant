import type { LazyRedisClient, RedisClient } from "@voyant-travel/utils/redis-client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clientIpKey,
  createRedisRateLimitStore,
  type RateLimitStore,
  resolveRateLimitStore,
} from "../../src/middleware/rate-limit.js"

class FakeRedisClient implements RedisClient {
  readonly values = new Map<string, string>()
  readonly expiries = new Map<string, number>()

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.values.get(key) ?? null) as T | null
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<unknown> {
    this.values.set(key, value)
    if (options?.ex !== undefined) this.expiries.set(key, options.ex)
  }

  async del(key: string): Promise<unknown> {
    this.values.delete(key)
    this.expiries.delete(key)
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.values.get(key) ?? "0") + 1
    this.values.set(key, String(next))
    return next
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    this.expiries.set(key, seconds)
  }
}

function fakeClient(client: RedisClient): LazyRedisClient {
  return { get: async () => client }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("clientIpKey", () => {
  it("supports standard Node reverse-proxy client IP headers", () => {
    const headers: Record<string, string> = { "x-real-ip": "203.0.113.42" }
    expect(clientIpKey({ req: { header: (name) => headers[name] } })).toBe("203.0.113.42")
  })
})

describe("resolveRateLimitStore", () => {
  it("uses an injected RateLimitStore", async () => {
    const store: RateLimitStore = {
      limit: vi.fn(async () => ({ allowed: true, remaining: 1 })),
    }
    const resolved = resolveRateLimitStore({ env: { RATE_LIMIT_STORE: store } })
    expect(resolved).toBe(store)
    await resolved.limit("k", { max: 1, windowSeconds: 60 })
    expect(store.limit).toHaveBeenCalledOnce()
  })
})

describe("createRedisRateLimitStore", () => {
  it("uses atomic INCR and sets expiry for a new fixed window", async () => {
    const incr = vi.fn(async () => 1)
    const expire = vi.fn(async () => undefined)
    const store = createRedisRateLimitStore("https://example.test?token=test-token", {
      client: {
        get: async () => ({
          incr,
          expire,
          get: async () => null,
          set: async () => undefined,
          del: async () => undefined,
        }),
      },
    })

    await expect(store.limit("lim:test:client", { max: 2, windowSeconds: 60 })).resolves.toEqual(
      expect.objectContaining({ allowed: true, remaining: 1 }),
    )
    expect(incr).toHaveBeenCalledWith(expect.stringMatching(/^lim:test:client:/))
    expect(expire).toHaveBeenCalledWith(expect.stringMatching(/^lim:test:client:/), 120)
  })

  it("isolates counters by keyPrefix", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-21T00:00:00.000Z"))
    const client = new FakeRedisClient()
    const eu = createRedisRateLimitStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:eu:rate:",
    })
    const us = createRedisRateLimitStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:us:rate:",
    })

    await expect(eu.limit("lim:auth:client", { max: 1, windowSeconds: 60 })).resolves.toEqual(
      expect.objectContaining({ allowed: true, remaining: 0 }),
    )
    await expect(eu.limit("lim:auth:client", { max: 1, windowSeconds: 60 })).resolves.toEqual(
      expect.objectContaining({ allowed: false, remaining: 0 }),
    )
    await expect(us.limit("lim:auth:client", { max: 1, windowSeconds: 60 })).resolves.toEqual(
      expect.objectContaining({ allowed: true, remaining: 0 }),
    )

    expect([...client.values.keys()].sort()).toEqual([
      "voyant:v1:eu:rate:lim:auth:client:29743200",
      "voyant:v1:us:rate:lim:auth:client:29743200",
    ])
  })

  it("sets expiry on the prefixed fixed-window key only once", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-21T00:00:00.000Z"))
    const client = new FakeRedisClient()
    const store = createRedisRateLimitStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:eu:rate:",
    })

    await store.limit("lim:auth:client", { max: 2, windowSeconds: 30 })
    await store.limit("lim:auth:client", { max: 2, windowSeconds: 30 })

    expect(client.expiries).toEqual(new Map([["voyant:v1:eu:rate:lim:auth:client:59486400", 60]]))
  })

  it("rejects control characters in keyPrefix", () => {
    expect(() =>
      createRedisRateLimitStore("https://example.test?token=test-token", {
        client: fakeClient(new FakeRedisClient()),
        keyPrefix: "voyant:v1:bad\nnamespace:rate:",
      }),
    ).toThrow(/keyPrefix/)
  })
})
