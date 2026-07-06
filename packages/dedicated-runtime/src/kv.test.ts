import { describe, expect, it, vi } from "vitest"

import { createKvNamespaceShim, type KvFetch } from "./kv.js"

function mockFetch(
  handler: (url: string, init: RequestInit) => { status?: number; body?: string },
): { fetch: KvFetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetch: KvFetch = async (input, init = {}) => {
    const url = String(input)
    calls.push({ url, init })
    const { status = 200, body = "" } = handler(url, init)
    return new Response(body, { status })
  }
  return { fetch, calls }
}

const base = {
  accountId: "acct-1",
  namespaceId: "ns-1",
  apiToken: "secret-token",
}

describe("createKvNamespaceShim", () => {
  it("GETs the value endpoint with a bearer token and returns text", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: "hello" }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })

    const value = await kv.get("greeting")

    expect(value).toBe("hello")
    expect(calls[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-1/storage/kv/namespaces/ns-1/values/greeting",
    )
    expect(calls[0]?.init.method).toBe("GET")
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer secret-token",
    )
  })

  it("parses JSON with get(key, 'json') and get(key, { type })", async () => {
    const payload = JSON.stringify({ a: 1 })
    const { fetch } = mockFetch(() => ({ body: payload }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })

    expect(await kv.get("k", "json")).toEqual({ a: 1 })
    expect(await kv.get("k", { type: "json" })).toEqual({ a: 1 })
  })

  it("returns null on 404", async () => {
    const { fetch } = mockFetch(() => ({ status: 404 }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })
    expect(await kv.get("missing")).toBeNull()
  })

  it("PUTs with expiration_ttl query param", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 200 }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })

    await kv.put("session", "value", { expirationTtl: 300 })

    expect(calls[0]?.init.method).toBe("PUT")
    expect(calls[0]?.url).toContain("expiration_ttl=300")
    expect(calls[0]?.init.body).toBe("value")
  })

  it("DELETEs the value endpoint and tolerates 404", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 404 }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })

    await expect(kv.delete("gone")).resolves.toBeUndefined()
    expect(calls[0]?.init.method).toBe("DELETE")
  })

  it("throws on non-404 error responses", async () => {
    const { fetch } = mockFetch(() => ({ status: 500, body: "boom" }))
    const kv = createKvNamespaceShim({ ...base, fetchImpl: fetch })
    await expect(kv.get("k")).rejects.toThrow(/KV get failed \(500\)/)
  })

  describe("LRU read-through", () => {
    it("serves repeat reads from cache without a second fetch", async () => {
      const spy = vi.fn(() => ({ body: "cached" }))
      const { fetch, calls } = mockFetch(spy)
      const kv = createKvNamespaceShim({
        ...base,
        fetchImpl: fetch,
        lru: { maxEntries: 10, ttlMs: 60_000 },
      })

      expect(await kv.get("k")).toBe("cached")
      expect(await kv.get("k")).toBe("cached")
      expect(calls).toHaveLength(1)
    })

    it("invalidates the cache on put and delete", async () => {
      let body = "v1"
      const { fetch, calls } = mockFetch(() => ({ body }))
      const kv = createKvNamespaceShim({
        ...base,
        fetchImpl: fetch,
        lru: { maxEntries: 10, ttlMs: 60_000 },
      })

      expect(await kv.get("k")).toBe("v1")
      await kv.put("k", "v2")
      expect(await kv.get("k")).toBe("v2") // served from LRU write-through
      await kv.delete("k")
      body = "v3"
      expect(await kv.get("k")).toBe("v3") // cache cleared -> refetch
      expect(calls.filter((c) => c.init.method === "GET")).toHaveLength(2)
    })

    it("caps a write-through entry at the put's expirationTtl", async () => {
      vi.useFakeTimers()
      try {
        const { fetch, calls } = mockFetch(() => ({ body: "remote" }))
        const kv = createKvNamespaceShim({
          ...base,
          fetchImpl: fetch,
          lru: { maxEntries: 10, ttlMs: 60_000 },
        })

        // Remote key expires after 1s; the local entry must not outlive it
        // even though the LRU's own ttlMs is 60s.
        await kv.put("session", "local", { expirationTtl: 1 })
        expect(await kv.get("session")).toBe("local")
        expect(calls.filter((c) => c.init.method === "GET")).toHaveLength(0)

        vi.advanceTimersByTime(1_500)
        expect(await kv.get("session")).toBe("remote")
        expect(calls.filter((c) => c.init.method === "GET")).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it("evicts least-recently-used entries past maxEntries", async () => {
      const { fetch, calls } = mockFetch((url) => ({ body: url }))
      const kv = createKvNamespaceShim({
        ...base,
        fetchImpl: fetch,
        lru: { maxEntries: 2, ttlMs: 60_000 },
      })

      await kv.get("a")
      await kv.get("b")
      await kv.get("a") // a is now most-recent
      await kv.get("c") // evicts b
      const before = calls.length
      await kv.get("b") // must refetch
      expect(calls.length).toBe(before + 1)
    })
  })
})
