import { describe, expect, it, vi } from "vitest"

import { AgentRunnerCoordinator } from "./coordinator.js"

describe("agent runner coordinator durable object", () => {
  it("acquires, rejects, inspects, and releases locks", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-12T12:00:00.000Z"))
    const coordinator = new AgentRunnerCoordinator(fakeDurableObjectState())

    const acquired = await coordinator.fetch(
      jsonRequest("https://coordinator.test/locks/acquire", {
        holder: "runner:one",
        key: "voyantjs/voyant:579",
        ttlSeconds: 60,
      }),
    )
    expect(acquired.status).toBe(201)
    await expect(acquired.json()).resolves.toMatchObject({
      acquired: true,
      lock: {
        expiresAt: "2026-05-12T12:01:00.000Z",
        holder: "runner:one",
        key: "voyantjs/voyant:579",
      },
    })

    const rejected = await coordinator.fetch(
      jsonRequest("https://coordinator.test/locks/acquire", {
        holder: "runner:two",
        key: "voyantjs/voyant:579",
        ttlSeconds: 60,
      }),
    )
    expect(rejected.status).toBe(409)
    await expect(rejected.json()).resolves.toMatchObject({
      acquired: false,
      reason: "lock_held",
    })

    const inspected = await coordinator.fetch(
      new Request("https://coordinator.test/locks/voyantjs%2Fvoyant%3A579"),
    )
    expect(inspected.status).toBe(200)
    await expect(inspected.json()).resolves.toMatchObject({
      expired: false,
      lock: {
        holder: "runner:one",
      },
    })

    const released = await coordinator.fetch(
      jsonRequest("https://coordinator.test/locks/release", {
        holder: "runner:one",
        key: "voyantjs/voyant:579",
      }),
    )
    expect(released.status).toBe(200)
    await expect(released.json()).resolves.toEqual({ released: true })

    vi.useRealTimers()
  })

  it("allows a new holder after an existing lock expires", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-12T12:00:00.000Z"))
    const coordinator = new AgentRunnerCoordinator(fakeDurableObjectState())

    await coordinator.fetch(
      jsonRequest("https://coordinator.test/locks/acquire", {
        holder: "runner:one",
        key: "voyantjs/voyant:579",
        ttlSeconds: 1,
      }),
    )
    vi.setSystemTime(new Date("2026-05-12T12:00:02.000Z"))

    const acquired = await coordinator.fetch(
      jsonRequest("https://coordinator.test/locks/acquire", {
        holder: "runner:two",
        key: "voyantjs/voyant:579",
        ttlSeconds: 60,
      }),
    )

    expect(acquired.status).toBe(201)
    await expect(acquired.json()).resolves.toMatchObject({
      acquired: true,
      lock: {
        holder: "runner:two",
      },
    })

    vi.useRealTimers()
  })
})

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  })
}

function fakeDurableObjectState() {
  const storage = new Map<string, unknown>()
  return {
    storage: {
      async delete(key: string) {
        storage.delete(key)
      },
      async get<T>(key: string) {
        return storage.get(key) as T | undefined
      },
      async put(key: string, value: unknown) {
        storage.set(key, value)
      },
    },
  }
}
