import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it } from "vitest"

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
