import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createNodeServer, type NodeServerHandle } from "./node-server.js"
import { ORIGIN_TRUST_HEADER } from "./trust.js"

const handles: NodeServerHandle[] = []

afterEach(async () => {
  while (handles.length) {
    await handles.pop()?.close()
  }
})

async function ready(handle: NodeServerHandle): Promise<number> {
  const server = handle.server
  if (!server.listening) {
    await new Promise<void>((resolve) => server.once("listening", () => resolve()))
  }
  const addr = server.address() as AddressInfo
  return addr.port
}

function boot<Env extends Record<string, unknown>>(
  options: Parameters<typeof createNodeServer<Env>>[0],
): NodeServerHandle {
  const handle = createNodeServer<Env>({ ...options, port: 0 })
  handles.push(handle)
  return handle
}

describe("createNodeServer", () => {
  it("starts resident services and idempotently waits for them during explicit shutdown", async () => {
    let finishStop!: () => void
    const stopPending = new Promise<void>((resolve) => {
      finishStop = resolve
    })
    const service = {
      start: vi.fn(),
      stop: vi.fn(() => stopPending),
    }
    const handle = boot({
      env: {},
      fetch: () => new Response("app"),
      residentServices: [service],
    })
    await ready(handle)

    expect(service.start).toHaveBeenCalledOnce()
    const closing = handle.close()
    expect(handle.close()).toBe(closing)
    await vi.waitFor(() => expect(service.stop).toHaveBeenCalledOnce())

    let closed = false
    void closing.then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)

    finishStop()
    await closing
    expect(closed).toBe(true)
  })

  it.each([
    "SIGTERM",
    "SIGINT",
  ] as const)("uses the same resident-service shutdown path for %s", async (signal) => {
    const signalHandlers = new Map<string, () => void>()
    const once = vi.spyOn(process, "once").mockImplementation(((
      event: string | symbol,
      listener: (...args: unknown[]) => void,
    ) => {
      if (event === "SIGTERM" || event === "SIGINT") {
        signalHandlers.set(event, () => listener())
      }
      return process
    }) as typeof process.once)
    const off = vi.spyOn(process, "off").mockImplementation((() => process) as typeof process.off)
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined as never) as typeof process.exit)
    let finishStop!: () => void
    const service = {
      start: vi.fn(),
      stop: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishStop = resolve
          }),
      ),
    }

    try {
      const handle = boot({
        env: {},
        fetch: () => new Response("app"),
        residentServices: [service],
      })
      await ready(handle)
      signalHandlers.get(signal)?.()

      await vi.waitFor(() => expect(service.stop).toHaveBeenCalledOnce())
      expect(exit).not.toHaveBeenCalled()
      finishStop()
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
      expect(off).toHaveBeenCalledWith("SIGTERM", expect.any(Function))
      expect(off).toHaveBeenCalledWith("SIGINT", expect.any(Function))
    } finally {
      once.mockRestore()
      off.mockRestore()
      exit.mockRestore()
    }
  })

  it("stops already-admitted resident services when service startup fails", async () => {
    const startupError = new Error("worker startup failed")
    const admitted = { start: vi.fn(), stop: vi.fn() }
    const failing = {
      start: vi.fn(() => {
        throw startupError
      }),
      stop: vi.fn(),
    }

    expect(() =>
      boot({
        env: {},
        fetch: () => new Response("app"),
        residentServices: [admitted, failing],
      }),
    ).toThrow(startupError)
    await vi.waitFor(() => {
      expect(admitted.stop).toHaveBeenCalledOnce()
      expect(failing.stop).toHaveBeenCalledOnce()
    })
  })

  it("runs the app fetch with the composed env and a real waitUntil ctx", async () => {
    let sideEffectDone = false
    const handle = boot({
      env: { GREETING: "hi" },
      fetch: (_req, env, ctx) => {
        ctx.waitUntil(
          new Promise<void>((resolve) =>
            setTimeout(() => {
              sideEffectDone = true
              resolve()
            }, 20),
          ),
        )
        return new Response(env.GREETING as string)
      },
    })
    const port = await ready(handle)

    const res = await fetch(`http://127.0.0.1:${port}/anything`)
    expect(await res.text()).toBe("hi")

    await handle.close()
    expect(sideEffectDone).toBe(true)
  })

  it("rejects requests without a valid origin-trust header, exempting /healthz", async () => {
    const handle = boot({
      env: {},
      originTrustSecret: "top-secret",
      fetch: () => new Response("app"),
    })
    const port = await ready(handle)

    const denied = await fetch(`http://127.0.0.1:${port}/v1/admin/x`)
    expect(denied.status).toBe(403)

    const health = await fetch(`http://127.0.0.1:${port}/healthz`)
    expect(health.status).toBe(200)

    const allowed = await fetch(`http://127.0.0.1:${port}/v1/admin/x`, {
      headers: { [ORIGIN_TRUST_HEADER]: "top-secret" },
    })
    expect(await allowed.text()).toBe("app")
  })

  it("dispatches the scheduled handler over HTTP with the cron expression", async () => {
    let seenCron: string | undefined
    const handle = boot({
      env: {},
      originTrustSecret: "top-secret",
      fetch: () => new Response("app"),
      scheduled: (event) => {
        seenCron = event.cron
      },
    })
    const port = await ready(handle)

    const res = await fetch(
      `http://127.0.0.1:${port}/__voyant/scheduled?cron=${encodeURIComponent("*/2 * * * *")}`,
      { method: "POST", headers: { [ORIGIN_TRUST_HEADER]: "top-secret" } },
    )
    expect(res.status).toBe(202)
    expect(seenCron).toBe("*/2 * * * *")
  })

  it("dispatches the scheduled handler over HTTP with the stable schedule id", async () => {
    let seenScheduleId: string | undefined
    let seenCron: string | undefined
    const handle = boot({
      env: {},
      originTrustSecret: "top-secret",
      fetch: () => new Response("app"),
      scheduled: (event) => {
        seenScheduleId = event.scheduleId
        seenCron = event.cron
      },
    })
    const port = await ready(handle)

    const res = await fetch(`http://127.0.0.1:${port}/__voyant/scheduled?schedule=outbox-drain`, {
      method: "POST",
      headers: { [ORIGIN_TRUST_HEADER]: "top-secret" },
    })
    expect(res.status).toBe(202)
    expect(seenScheduleId).toBe("outbox-drain")
    expect(seenCron).toBeUndefined()
  })

  it("dispatches both stable schedule id and legacy cron when both are present", async () => {
    let seenScheduleId: string | undefined
    let seenCron: string | undefined
    const handle = boot({
      env: {},
      originTrustSecret: "top-secret",
      fetch: () => new Response("app"),
      scheduled: (event) => {
        seenScheduleId = event.scheduleId
        seenCron = event.cron
      },
    })
    const port = await ready(handle)

    const res = await fetch(
      `http://127.0.0.1:${port}/__voyant/scheduled?schedule=outbox-drain&cron=${encodeURIComponent("*/2 * * * *")}`,
      { method: "POST", headers: { [ORIGIN_TRUST_HEADER]: "top-secret" } },
    )
    expect(res.status).toBe(202)
    expect(seenScheduleId).toBe("outbox-drain")
    expect(seenCron).toBe("*/2 * * * *")
  })

  it("requires trust for the scheduled hook", async () => {
    const handle = boot({
      env: {},
      originTrustSecret: "top-secret",
      fetch: () => new Response("app"),
      scheduled: () => undefined,
    })
    const port = await ready(handle)

    const res = await fetch(`http://127.0.0.1:${port}/__voyant/scheduled?cron=x`, {
      method: "POST",
    })
    expect(res.status).toBe(403)
  })
})
