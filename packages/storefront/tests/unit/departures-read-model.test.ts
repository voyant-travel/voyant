import type { Context } from "hono"
import { describe, expect, it, vi } from "vitest"

import { departuresDocKey, readThroughDepartures } from "../../src/routes-public.js"

function fakeKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async <T = string>(key: string, options?: { type?: "json" | "text" }) => {
      const value = store.get(key)
      if (value === undefined) return null
      return (options?.type === "json" ? JSON.parse(value) : value) as T | null
    }),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, value)
      return options
    }),
    delete: vi.fn(async () => {}),
  }
}

function ctxWith(kv: ReturnType<typeof fakeKv> | undefined) {
  return { env: { CACHE: kv } } as unknown as Context<never>
}

describe("departuresDocKey", () => {
  it("is stable across param order and skips nullish params", () => {
    const a = departuresDocKey("prod_1", { from: "2026-07-01", limit: 50, to: undefined })
    const b = departuresDocKey("prod_1", { limit: 50, from: "2026-07-01" })
    expect(a).toBe(b)
    expect(a).toContain("prod_1")
  })

  it("differs per product and per params", () => {
    expect(departuresDocKey("prod_1", {})).not.toBe(departuresDocKey("prod_2", {}))
    expect(departuresDocKey("prod_1", { limit: 10 })).not.toBe(
      departuresDocKey("prod_1", { limit: 20 }),
    )
  })
})

describe("readThroughDepartures", () => {
  it("computes once and serves the repeat from KV", async () => {
    const kv = fakeKv()
    const compute = vi.fn(async () => ({ data: [{ id: "dep_1" }] }))
    const key = departuresDocKey("prod_1", {})

    const first = await readThroughDepartures(ctxWith(kv), key, compute)
    const second = await readThroughDepartures(ctxWith(kv), key, compute)

    expect(first).toEqual({ data: [{ id: "dep_1" }] })
    expect(second).toEqual({ data: [{ id: "dep_1" }] })
    expect(compute).toHaveBeenCalledOnce()
    // TTL-bounded freshness: departures shift with bookings.
    const putOptions = kv.put.mock.calls[0]?.[2] as { expirationTtl?: number }
    expect(putOptions?.expirationTtl).toBe(120)
  })

  it("degrades to live compute without a CACHE binding", async () => {
    const compute = vi.fn(async () => ({ data: [] }))
    await readThroughDepartures(ctxWith(undefined), "k", compute)
    await readThroughDepartures(ctxWith(undefined), "k", compute)
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it("degrades to live compute when KV reads throw", async () => {
    const kv = fakeKv()
    kv.get.mockRejectedValue(new Error("kv down"))
    const compute = vi.fn(async () => ({ data: [] }))

    const result = await readThroughDepartures(ctxWith(kv), "k", compute)

    expect(result).toEqual({ data: [] })
    expect(compute).toHaveBeenCalledOnce()
  })
})
