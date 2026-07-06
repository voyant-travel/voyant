import { describe, expect, it } from "vitest"

import { createMemoryKvNamespace } from "./memory-kv.js"

describe("createMemoryKvNamespace", () => {
  it("puts and gets text values", async () => {
    const kv = createMemoryKvNamespace()
    await kv.put("k", "v")
    expect(await kv.get("k")).toBe("v")
  })

  it("returns null for missing keys", async () => {
    const kv = createMemoryKvNamespace()
    expect(await kv.get("nope")).toBeNull()
  })

  it("parses JSON with the json type", async () => {
    const kv = createMemoryKvNamespace()
    await kv.put("obj", JSON.stringify({ a: 1 }))
    expect(await kv.get<{ a: number }>("obj", "json")).toEqual({ a: 1 })
    expect(await kv.get<{ a: number }>("obj", { type: "json" })).toEqual({ a: 1 })
  })

  it("deletes keys", async () => {
    const kv = createMemoryKvNamespace()
    await kv.put("k", "v")
    await kv.delete("k")
    expect(await kv.get("k")).toBeNull()
  })

  it("expires entries after expirationTtl seconds", async () => {
    let clock = 1_000
    const kv = createMemoryKvNamespace({ now: () => clock })
    await kv.put("k", "v", { expirationTtl: 30 })
    expect(await kv.get("k")).toBe("v")
    clock += 30_001
    expect(await kv.get("k")).toBeNull()
  })

  it("evicts least-recently-used entries past maxEntries", async () => {
    const kv = createMemoryKvNamespace({ maxEntries: 2 })
    await kv.put("a", "1")
    await kv.put("b", "2")
    // Touch "a" so "b" becomes the LRU victim.
    await kv.get("a")
    await kv.put("c", "3")
    expect(await kv.get("a")).toBe("1")
    expect(await kv.get("b")).toBeNull()
    expect(await kv.get("c")).toBe("3")
  })
})
