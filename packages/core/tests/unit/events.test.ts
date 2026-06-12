import { describe, expect, it, vi } from "vitest"

import { createEventBus } from "../../src/events.js"

describe("createEventBus", () => {
  it("delivers emitted events to subscribers", async () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.subscribe("booking.created", handler)

    await bus.emit("booking.created", { id: "book_1" })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "booking.created",
        data: { id: "book_1" },
        emittedAt: expect.any(String),
      }),
    )
  })

  it("delivers to multiple subscribers for the same event", async () => {
    const bus = createEventBus()
    const a = vi.fn()
    const b = vi.fn()
    bus.subscribe("quote.sent", a)
    bus.subscribe("quote.sent", b)

    await bus.emit("quote.sent", { id: "q1" })

    expect(a).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "quote.sent",
        data: { id: "q1" },
      }),
    )
    expect(b).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "quote.sent",
        data: { id: "q1" },
      }),
    )
  })

  it("includes metadata in the delivered envelope when provided", async () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.subscribe("invoice.settled", handler)

    await bus.emit(
      "invoice.settled",
      { id: "inv_1" },
      { category: "domain", source: "service", correlationId: "corr_123" },
    )

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "invoice.settled",
        data: { id: "inv_1" },
        metadata: {
          category: "domain",
          source: "service",
          correlationId: "corr_123",
        },
      }),
    )
  })

  it("does nothing when no subscribers are registered", async () => {
    const bus = createEventBus()
    await expect(bus.emit("unknown.event", {})).resolves.toBeUndefined()
  })

  it("returns an unsubscribe handle that removes the handler", async () => {
    const bus = createEventBus()
    const handler = vi.fn()
    const sub = bus.subscribe("x", handler)
    sub.unsubscribe()

    await bus.emit("x", {})

    expect(handler).not.toHaveBeenCalled()
  })

  it("continues delivering to later subscribers after one throws", async () => {
    const bus = createEventBus()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const good = vi.fn()
    bus.subscribe("x", () => {
      throw new Error("boom")
    })
    bus.subscribe("x", good)

    await bus.emit("x", {})

    expect(good).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("runs handlers in parallel — a slow handler does not serialize a fast one", async () => {
    const bus = createEventBus()
    const order: number[] = []
    bus.subscribe("x", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      order.push(1)
    })
    bus.subscribe("x", () => {
      order.push(2)
    })

    await bus.emit("x", {})

    // Both completed before emit resolved, but the synchronous handler
    // did not wait behind the slow one.
    expect(order).toEqual([2, 1])
  })

  it("awaits all handlers before resolving when no scheduler is provided", async () => {
    const bus = createEventBus()
    let done = false
    bus.subscribe("x", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      done = true
    })

    await bus.emit("x", {})

    expect(done).toBe(true)
  })

  it("stops awaiting a handler that exceeds handlerTimeoutMs", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const bus = createEventBus({ handlerTimeoutMs: 20 })
    let hungResolved = false
    bus.subscribe("x", async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      hungResolved = true
    })

    const start = Date.now()
    await bus.emit("x", {})
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(150)
    expect(hungResolved).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("exceeded 20ms"))
    errorSpy.mockRestore()
  })

  describe("deferred emission via EmitOptions.schedule", () => {
    it("hands deferrable handlers to the scheduler and resolves without awaiting them", async () => {
      const bus = createEventBus()
      let deferredRan = false
      const scheduled: Promise<unknown>[] = []
      bus.subscribe("x", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        deferredRan = true
      })

      await bus.emit("x", {}, undefined, { schedule: (p) => scheduled.push(p) })

      expect(deferredRan).toBe(false)
      expect(scheduled).toHaveLength(1)
      await Promise.all(scheduled)
      expect(deferredRan).toBe(true)
    })

    it("still awaits inline-marked handlers before resolving", async () => {
      const bus = createEventBus()
      const order: string[] = []
      const scheduled: Promise<unknown>[] = []
      bus.subscribe(
        "x",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          order.push("inline")
        },
        { inline: true },
      )
      // Deferred work starts concurrently — `schedule` only means emit
      // doesn't wait for it. Make it slower than the inline handler so
      // we can observe that emit resolved without it.
      bus.subscribe("x", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        order.push("deferred")
      })

      await bus.emit("x", {}, undefined, { schedule: (p) => scheduled.push(p) })

      expect(order).toEqual(["inline"])
      await Promise.all(scheduled)
      expect(order).toEqual(["inline", "deferred"])
    })

    it("does not invoke the scheduler when every handler is inline", async () => {
      const bus = createEventBus()
      const schedule = vi.fn()
      const handler = vi.fn()
      bus.subscribe("x", handler, { inline: true })

      await bus.emit("x", {}, undefined, { schedule })

      expect(handler).toHaveBeenCalledOnce()
      expect(schedule).not.toHaveBeenCalled()
    })

    it("scheduled batch never rejects even when a deferred handler throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const bus = createEventBus()
      const scheduled: Promise<unknown>[] = []
      bus.subscribe("x", () => {
        throw new Error("boom")
      })

      await bus.emit("x", {}, undefined, { schedule: (p) => scheduled.push(p) })
      await expect(Promise.all(scheduled)).resolves.toBeDefined()

      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })
})
