import type { EventEnvelope } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import { createRealtimeBridge } from "../../src/bridge.js"
import { createLocalRealtimeProvider } from "../../src/providers/local.js"

function envelope<T>(name: string, data: T): EventEnvelope<T> {
  return { name, data, emittedAt: new Date().toISOString() }
}

describe("createRealtimeBridge", () => {
  it("registers one deferred subscriber per route", () => {
    const subscribers = createRealtimeBridge({
      provider: createLocalRealtimeProvider(),
      routes: {
        "booking.confirmed": () => ["admin"],
        "invoice.issued": () => ["admin"],
      },
    })

    expect(subscribers).toHaveLength(2)
    expect(subscribers.map((s) => s.event).sort()).toEqual(["booking.confirmed", "invoice.issued"])
    expect(subscribers.every((s) => s.inline === false)).toBe(true)
  })

  it("publishes an invalidation hint to each channel (terse array form)", async () => {
    const sink = vi.fn()
    const provider = createLocalRealtimeProvider({ sink })
    const [subscriber] = createRealtimeBridge({
      provider,
      routes: {
        "booking.confirmed": (e: { bookingId: string }) => ["admin", `booking:${e.bookingId}`],
      },
    })

    await subscriber.handler(envelope("booking.confirmed", { bookingId: "bk_42" }))

    expect(sink).toHaveBeenCalledTimes(2)
    expect(sink).toHaveBeenCalledWith("admin", {
      event: "booking.confirmed",
      data: { event: "booking.confirmed", entity: "booking" },
    })
    expect(sink).toHaveBeenCalledWith("booking:bk_42", {
      event: "booking.confirmed",
      data: { event: "booking.confirmed", entity: "booking" },
    })
  })

  it("merges an explicit hint (object form) including the entity id", async () => {
    const sink = vi.fn()
    const provider = createLocalRealtimeProvider({ sink })
    const [subscriber] = createRealtimeBridge({
      provider,
      routes: {
        "availability.slot.changed": (e: { productId: string }) => ({
          channels: [`product:${e.productId}`],
          hint: { entity: "availability", id: e.productId },
        }),
      },
    })

    await subscriber.handler(envelope("availability.slot.changed", { productId: "prod_7" }))

    expect(sink).toHaveBeenCalledWith("product:prod_7", {
      event: "availability.slot.changed",
      data: { event: "availability.slot.changed", entity: "availability", id: "prod_7" },
    })
  })

  it("skips publishing when a route yields no channels", async () => {
    const sink = vi.fn()
    const provider = createLocalRealtimeProvider({ sink })
    const [subscriber] = createRealtimeBridge({
      provider,
      routes: { "booking.confirmed": () => [] },
    })

    await subscriber.handler(envelope("booking.confirmed", {}))
    expect(sink).not.toHaveBeenCalled()
  })

  it("never throws on publish failure — routes failures to onError", async () => {
    const onError = vi.fn()
    const failing = {
      name: "failing",
      publish: vi.fn().mockRejectedValue(new Error("transport down")),
      mintClientToken: vi.fn(),
    }
    const [subscriber] = createRealtimeBridge({
      provider: failing,
      routes: { "booking.confirmed": () => ["admin"] },
      onError,
    })

    await expect(subscriber.handler(envelope("booking.confirmed", {}))).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      event: "booking.confirmed",
      channel: "admin",
    })
  })
})
