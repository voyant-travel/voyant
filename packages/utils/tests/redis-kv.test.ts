import { describe, expect, it } from "vitest"

import type { LazyRedisClient, RedisClient } from "../src/redis-client.js"
import { createRedisKvStore } from "../src/redis-kv.js"

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

  async scan(
    cursor: number,
    options?: { match?: string; count?: number },
  ): Promise<[number | string, string[]]> {
    if (cursor !== 0) return [0, []]
    const pattern = options?.match ?? "*"
    return [0, [...this.values.keys()].filter((key) => redisGlobMatches(pattern, key)).sort()]
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

function redisGlobMatches(pattern: string, value: string): boolean {
  let regex = "^"
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === "\\") {
      const next = pattern[index + 1]
      regex += escapeRegExp(next ?? "\\")
      if (next !== undefined) index += 1
      continue
    }
    if (char === "*") {
      regex += ".*"
      continue
    }
    if (char === "?") {
      regex += "."
      continue
    }
    regex += escapeRegExp(char ?? "")
  }
  return new RegExp(`${regex}$`, "u").test(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

describe("createRedisKvStore with keyPrefix", () => {
  it("isolates adjacent namespaces and lists logical keys", async () => {
    const client = new FakeRedisClient()
    const eu = createRedisKvStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:eu:cache:",
    })
    const europe = createRedisKvStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:europe:cache:",
    })

    await eu.put("hotel:1", "eu")
    await europe.put("hotel:1", "europe")
    await eu.put("tour:1", "tour")

    await expect(eu.get("hotel:1")).resolves.toBe("eu")
    await expect(europe.get("hotel:1")).resolves.toBe("europe")
    await expect(eu.list({ prefix: "hotel:" })).resolves.toEqual({
      keys: [{ name: "hotel:1" }],
    })
  })

  it("deletes only the prefixed physical key", async () => {
    const client = new FakeRedisClient()
    const kv = createRedisKvStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:ro:cache:",
    })
    client.values.set("key", "unprefixed")

    await kv.put("key", "prefixed")
    await kv.delete("key")

    expect(client.values.get("key")).toBe("unprefixed")
    expect(client.values.has("voyant:v1:ro:cache:key")).toBe(false)
  })

  it("applies TTL to the prefixed physical key", async () => {
    const client = new FakeRedisClient()
    const kv = createRedisKvStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:ro:cache:",
    })

    await kv.put("key", "value", { expirationTtl: 1.2 })

    expect(client.expiries.get("voyant:v1:ro:cache:key")).toBe(2)
  })

  it("escapes Redis SCAN glob characters in the physical prefix", async () => {
    const client = new FakeRedisClient()
    const kv = createRedisKvStore("https://example.test?token=test-token", {
      client: fakeClient(client),
      keyPrefix: "voyant:v1:[ro]*?:cache:",
    })
    client.values.set("voyant:v1:[ro]*?:cache:hotel:1", "match")
    client.values.set("voyant:v1:r:cache:hotel:2", "glob-leak")

    await expect(kv.list({ prefix: "hotel:" })).resolves.toEqual({
      keys: [{ name: "hotel:1" }],
    })
  })

  it("rejects control characters in keyPrefix", () => {
    expect(() =>
      createRedisKvStore("https://example.test?token=test-token", {
        client: fakeClient(new FakeRedisClient()),
        keyPrefix: "voyant:v1:bad\nnamespace:cache:",
      }),
    ).toThrow(/keyPrefix/)
  })
})

const describeIfRedis = process.env.REDIS_URL ? describe : describe.skip

describeIfRedis("createRedisKvStore", () => {
  it("round-trips text and JSON with TTL against REDIS_URL", async () => {
    const kv = createRedisKvStore(process.env.REDIS_URL!)
    const key = `test:kv:${Date.now()}`
    await kv.put(key, JSON.stringify({ ok: true }), { expirationTtl: 60 })
    expect(await kv.get(key, { type: "json" })).toEqual({ ok: true })
    await kv.delete(key)
    expect(await kv.get(key)).toBeNull()
  })
})
