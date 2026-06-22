import { describe, expect, it, vi } from "vitest"

import { createLocalRealtimeProvider } from "../../src/providers/local.js"
import { createRealtimeService, RealtimeError } from "../../src/service.js"

describe("createRealtimeService", () => {
  it("throws when constructed with no providers", () => {
    expect(() => createRealtimeService([])).toThrow(RealtimeError)
  })

  it("publishes through the default (first) provider", async () => {
    const sink = vi.fn()
    const provider = createLocalRealtimeProvider({ sink })
    const service = createRealtimeService([provider])

    await service.publish("admin", { event: "booking.confirmed", data: { id: "bk_1" } })

    expect(sink).toHaveBeenCalledWith("admin", {
      event: "booking.confirmed",
      data: { id: "bk_1" },
    })
    expect(service.defaultProvider.name).toBe("local")
  })

  it("routes to a named provider when one is given", async () => {
    const primarySink = vi.fn()
    const secondarySink = vi.fn()
    const primary = createLocalRealtimeProvider({ name: "primary", sink: primarySink })
    const secondary = createLocalRealtimeProvider({ name: "secondary", sink: secondarySink })
    const service = createRealtimeService([primary, secondary])

    await service.publish("admin", { event: "x.y", data: 1 }, "secondary")

    expect(secondarySink).toHaveBeenCalledOnce()
    expect(primarySink).not.toHaveBeenCalled()
  })

  it("throws when a named provider is not registered", async () => {
    const service = createRealtimeService([createLocalRealtimeProvider()])
    await expect(service.publish("admin", { event: "x.y", data: 1 }, "nope")).rejects.toThrow(
      RealtimeError,
    )
  })

  it("mints a token with the requested ttl", async () => {
    const service = createRealtimeService([createLocalRealtimeProvider()])
    const minted = await service.mintClientToken({
      clientId: "user_1",
      capabilities: { admin: ["subscribe"] },
      ttlSeconds: 120,
    })

    expect(minted.token).toContain("user_1")
    expect(new Date(minted.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })
})
