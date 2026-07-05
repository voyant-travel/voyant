import { describe, expect, it } from "vitest"

import { createWaitUntilRegistry } from "./wait-until.js"

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("createWaitUntilRegistry", () => {
  it("tracks pending promises and drains them", async () => {
    const registry = createWaitUntilRegistry()
    const ctx = registry.context()

    let done = false
    ctx.waitUntil(tick(20).then(() => (done = true)))
    expect(registry.pending()).toBe(1)

    await registry.drain(1000)
    expect(done).toBe(true)
    expect(registry.pending()).toBe(0)
  })

  it("resolves immediately when nothing is in flight", async () => {
    const registry = createWaitUntilRegistry()
    await expect(registry.drain(1000)).resolves.toBeUndefined()
  })

  it("stops waiting after the timeout for slow work", async () => {
    const registry = createWaitUntilRegistry()
    registry.context().waitUntil(tick(5000))
    const start = Date.now()
    await registry.drain(30)
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it("swallows rejections so drain never throws", async () => {
    const registry = createWaitUntilRegistry()
    registry.context().waitUntil(Promise.reject(new Error("boom")))
    await expect(registry.drain(1000)).resolves.toBeUndefined()
    expect(registry.pending()).toBe(0)
  })

  it("shares one registry across multiple request contexts", async () => {
    const registry = createWaitUntilRegistry()
    registry.context().waitUntil(tick(10))
    registry.context().waitUntil(tick(10))
    expect(registry.pending()).toBe(2)
    await registry.drain(1000)
    expect(registry.pending()).toBe(0)
  })
})
