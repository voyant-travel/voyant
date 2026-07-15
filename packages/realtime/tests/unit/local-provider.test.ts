import { describe, expect, it, vi } from "vitest"

import {
  createLocalGraphRealtimeProvider,
  createLocalRealtimeProvider,
} from "../../src/providers/local.js"

describe("createLocalRealtimeProvider", () => {
  it("constructs the deployment-selected local graph provider", () => {
    expect(createLocalGraphRealtimeProvider().name).toBe("local")
  })

  it("delivers published messages to in-process channel subscribers", async () => {
    const provider = createLocalRealtimeProvider({ sink: vi.fn() })
    const received: unknown[] = []
    const unsubscribe = provider.subscribe("booking:bk_1", (m) => received.push(m))

    await provider.publish("booking:bk_1", { event: "booking.confirmed", data: { id: "bk_1" } })
    await provider.publish("other", { event: "x.y", data: 1 })

    expect(received).toEqual([{ event: "booking.confirmed", data: { id: "bk_1" } }])

    unsubscribe()
    await provider.publish("booking:bk_1", { event: "booking.confirmed", data: { id: "bk_1" } })
    expect(received).toHaveLength(1)
  })

  it("mints inspectable tokens carrying the client id", async () => {
    const provider = createLocalRealtimeProvider({ name: "dev" })
    const a = await provider.mintClientToken({ clientId: "u1", capabilities: {} })
    const b = await provider.mintClientToken({ clientId: "u1", capabilities: {} })
    expect(a.token).not.toBe(b.token)
    expect(a.token.startsWith("dev_")).toBe(true)
    expect(a.token).toContain("u1")
  })
})
