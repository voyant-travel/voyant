import type { EventBus, OutboxEventStore } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import { requestScopedEventBus } from "../../src/lib/request-event-bus.js"

function fakeBus(emitImpl?: (...args: unknown[]) => Promise<void>) {
  return {
    emit: vi.fn(emitImpl ?? (async () => {})),
    subscribe: vi.fn(() => ({ unsubscribe() {} })),
  } as EventBus & { emit: ReturnType<typeof vi.fn> }
}

describe("requestScopedEventBus", () => {
  it("forwards the scheduler and the outbox store to the inner emit", async () => {
    const inner = fakeBus()
    const schedule = vi.fn()
    const store = { insert: vi.fn(), complete: vi.fn(), fail: vi.fn() }

    const bus = requestScopedEventBus(inner, schedule, store)
    await bus.emit("x", { a: 1 }, { correlationId: "c1" })

    expect(inner.emit).toHaveBeenCalledWith(
      "x",
      { a: 1 },
      { correlationId: "c1" },
      expect.objectContaining({ schedule, store: expect.any(Object) }),
    )
    const options = inner.emit.mock.calls[0]?.[3] as { store?: OutboxEventStore }
    expect(options.store).not.toBe(store)
  })

  it("falls back to direct (non-durable) delivery when outbox capture fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const store = {
      insert: vi.fn(async () => {
        throw new Error("db unreachable")
      }),
      complete: vi.fn(),
      fail: vi.fn(),
    }
    const inner = fakeBus(async (...args: unknown[]) => {
      const options = args[3] as { store?: unknown } | undefined
      if (options?.store) {
        await (options.store as OutboxEventStore).insert({
          name: "x",
          data: {},
          emittedAt: new Date().toISOString(),
        })
      }
    })

    const bus = requestScopedEventBus(inner, vi.fn(), store)
    await expect(bus.emit("x", {})).resolves.toBeUndefined()

    expect(inner.emit).toHaveBeenCalledTimes(2)
    const retryOptions = inner.emit.mock.calls[1]?.[3] as { store?: unknown }
    expect(retryOptions.store).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("outbox capture failed"),
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it("does not fall back to direct delivery after durable capture succeeds", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const store = {
      insert: vi.fn(async () => ({ id: "evob_1" })),
      complete: vi.fn(),
      fail: vi.fn(),
    }
    const inner = fakeBus(async (...args: unknown[]) => {
      const options = args[3] as { store?: OutboxEventStore } | undefined
      if (options?.store) {
        await options.store.insert({
          name: "x",
          data: {},
          emittedAt: new Date().toISOString(),
        })
        throw new Error("scheduler unavailable")
      }
    })

    const bus = requestScopedEventBus(inner, vi.fn(), store)
    await expect(bus.emit("x", {})).resolves.toBeUndefined()

    expect(inner.emit).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("durable delivery failed"),
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it("omits the store entirely when none is configured", async () => {
    const inner = fakeBus()
    const bus = requestScopedEventBus(inner, vi.fn())
    await bus.emit("x", {})
    const options = inner.emit.mock.calls[0]?.[3] as { store?: unknown }
    expect(options.store).toBeUndefined()
  })

  it("still threads the store with NO scheduler (Node/headless runtimes keep durable capture)", async () => {
    const inner = fakeBus()
    const store = { insert: vi.fn(), complete: vi.fn(), fail: vi.fn() }

    const bus = requestScopedEventBus(inner, undefined, store)
    await bus.emit("x", {})

    const options = inner.emit.mock.calls[0]?.[3] as { store?: unknown; schedule?: unknown }
    expect(options.store).toEqual(expect.any(Object))
    expect(options.store).not.toBe(store)
    expect(options.schedule).toBeUndefined()
  })
})
