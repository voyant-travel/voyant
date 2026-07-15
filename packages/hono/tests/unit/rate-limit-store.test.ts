import { describe, expect, it, vi } from "vitest"

import {
  clientIpKey,
  createRedisRateLimitStore,
  type RateLimitStore,
  resolveRateLimitStore,
} from "../../src/middleware/rate-limit.js"

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
})
