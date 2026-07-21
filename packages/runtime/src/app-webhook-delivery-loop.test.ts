import type { WebhookDeliveryWorker } from "@voyant-travel/webhook-delivery"
import { describe, expect, it, vi } from "vitest"

import { createAppWebhookDeliveryLoop } from "./app-webhook-delivery-loop.js"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe("createAppWebhookDeliveryLoop", () => {
  it("drains immediately, unrefs its timer, and prevents overlapping drains", async () => {
    const first = deferred()
    const drain = vi
      .fn<WebhookDeliveryWorker["drain"]>()
      .mockImplementationOnce(async () => {
        await first.promise
        return []
      })
      .mockResolvedValue([])
    const timer = { unref: vi.fn() }
    let tick: (() => void) | undefined
    const setInterval = vi.fn((callback: () => void) => {
      tick = callback
      return timer as unknown as ReturnType<typeof globalThis.setInterval>
    })
    const loop = createAppWebhookDeliveryLoop(
      { drain, runNext: vi.fn() },
      { setInterval: setInterval as unknown as typeof globalThis.setInterval },
    )

    loop.start()
    const firstPoll = loop.poll()
    expect(drain).toHaveBeenCalledOnce()
    expect(drain).toHaveBeenCalledWith({ limit: 100 })
    expect(timer.unref).toHaveBeenCalledOnce()

    tick?.()
    expect(drain).toHaveBeenCalledOnce()

    first.resolve()
    await firstPoll
    tick?.()
    await vi.waitFor(() => expect(drain).toHaveBeenCalledTimes(2))
  })

  it("reports a failed drain and continues on the next tick", async () => {
    const failure = new Error("database unavailable")
    const drain = vi
      .fn<WebhookDeliveryWorker["drain"]>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue([])
    const onError = vi.fn()
    let tick: (() => void) | undefined
    const loop = createAppWebhookDeliveryLoop(
      { drain, runNext: vi.fn() },
      {
        onError,
        setInterval: ((callback: () => void) => {
          tick = callback
          return 1 as unknown as ReturnType<typeof globalThis.setInterval>
        }) as typeof globalThis.setInterval,
      },
    )

    loop.start()
    await loop.poll()
    expect(onError).toHaveBeenCalledWith(failure)
    tick?.()
    await vi.waitFor(() => expect(drain).toHaveBeenCalledTimes(2))
  })

  it("clears the timer and waits for the active drain during shutdown", async () => {
    const active = deferred()
    const clearInterval = vi.fn()
    const loop = createAppWebhookDeliveryLoop(
      {
        drain: vi.fn(async () => {
          await active.promise
          return []
        }),
        runNext: vi.fn(),
      },
      {
        clearInterval,
        setInterval: (() => 42) as unknown as typeof globalThis.setInterval,
      },
    )
    loop.start()

    let stopped = false
    const stopping = loop.stop().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(clearInterval).toHaveBeenCalledWith(42)
    expect(stopped).toBe(false)

    active.resolve()
    await stopping
    expect(stopped).toBe(true)
  })
})
