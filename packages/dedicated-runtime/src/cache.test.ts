import { afterEach, describe, expect, it } from "vitest"

import { createCachesShim, installCachesShim, uninstallCachesShim } from "./cache.js"

function jsonResponse(body: unknown, cacheControl?: string): Response {
  const headers = new Headers({ "content-type": "application/json" })
  if (cacheControl) headers.set("cache-control", cacheControl)
  return new Response(JSON.stringify(body), { headers })
}

describe("createCachesShim", () => {
  it("stores and matches a response by URL", async () => {
    const cache = createCachesShim({ maxEntries: 10 })
    await cache.put("https://x/a", jsonResponse({ ok: true }, "s-maxage=60"))

    const hit = await cache.match("https://x/a")
    expect(hit).toBeDefined()
    expect(await hit!.json()).toEqual({ ok: true })
  })

  it("does not cache responses without a freshness directive", async () => {
    const cache = createCachesShim({ maxEntries: 10 })
    await cache.put("https://x/b", jsonResponse({ ok: true }))
    expect(await cache.match("https://x/b")).toBeUndefined()
  })

  it("prefers s-maxage over max-age and expires entries", async () => {
    const cache = createCachesShim({ maxEntries: 10 })
    await cache.put("https://x/c", jsonResponse({ n: 1 }, "max-age=0, s-maxage=0"))
    // ttl 0 -> not cached
    expect(await cache.match("https://x/c")).toBeUndefined()
  })

  it("evicts least-recently-used entries beyond maxEntries", async () => {
    const cache = createCachesShim({ maxEntries: 2 })
    await cache.put("https://x/1", jsonResponse({}, "s-maxage=60"))
    await cache.put("https://x/2", jsonResponse({}, "s-maxage=60"))
    await cache.match("https://x/1") // touch 1
    await cache.put("https://x/3", jsonResponse({}, "s-maxage=60")) // evict 2

    expect(await cache.match("https://x/1")).toBeDefined()
    expect(await cache.match("https://x/2")).toBeUndefined()
    expect(await cache.match("https://x/3")).toBeDefined()
  })

  it("skips entries exceeding maxBytes", async () => {
    const cache = createCachesShim({ maxEntries: 10, maxBytes: 4 })
    await cache.put("https://x/big", jsonResponse({ big: "xxxxxxxx" }, "s-maxage=60"))
    expect(await cache.match("https://x/big")).toBeUndefined()
  })
})

describe("installCachesShim", () => {
  afterEach(() => uninstallCachesShim())

  it("installs a caches.default that a probe can pick up", async () => {
    installCachesShim({ maxEntries: 10 })
    const probe = (globalThis as { caches?: { default?: unknown } }).caches?.default as {
      match: (r: string) => Promise<Response | undefined>
      put: (r: string, res: Response) => Promise<void>
    }
    expect(typeof probe.match).toBe("function")
    await probe.put("https://x/g", jsonResponse({ v: 1 }, "s-maxage=30"))
    const hit = await probe.match("https://x/g")
    expect(await hit!.json()).toEqual({ v: 1 })
  })

  it("is idempotent — returns the same instance on repeated install", () => {
    const first = installCachesShim({ maxEntries: 10 })
    const second = installCachesShim({ maxEntries: 99 })
    expect(second).toBe(first)
  })
})
