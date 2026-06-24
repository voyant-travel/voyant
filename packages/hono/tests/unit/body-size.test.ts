import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  requestBodyLimit,
} from "../../src/middleware/body-size.js"

const MAX_BYTES = 16

function buildApp() {
  const app = new Hono()
  app.use("*", requestBodyLimit({ maxBytes: MAX_BYTES }))
  app.post("/echo", async (c) => {
    const body = await c.req.text()
    return c.json({ received: body.length })
  })
  app.get("/ping", (c) => c.json({ ok: true }))
  return app
}

describe("requestBodyLimit middleware", () => {
  it("exposes the default cap", () => {
    expect(DEFAULT_REQUEST_BODY_LIMIT_BYTES).toBe(10 * 1024 * 1024)
  })

  it("rejects a request whose Content-Length exceeds the cap (header fast-path)", async () => {
    const app = buildApp()
    const body = "x".repeat(MAX_BYTES + 8)

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body,
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: "Request body too large",
      code: "request_body_too_large",
      maxBytes: MAX_BYTES,
    })
  })

  it("rejects an oversized streamed body with NO Content-Length header", async () => {
    const app = buildApp()
    const chunk = new TextEncoder().encode("x".repeat(MAX_BYTES + 8))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.close()
      },
    })

    const request = new Request("https://api.example/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: stream,
      // @ts-expect-error -- duplex is required by the runtime for a ReadableStream body but absent from the lib.dom RequestInit type
      duplex: "half",
    })
    // Guard the regression assumption: this body carries no Content-Length, so
    // the old header-only check would have let it through unbounded.
    expect(request.headers.get("content-length")).toBeNull()

    const response = await app.fetch(request)

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "request_body_too_large" })
  })

  it("passes a normal small body through to the handler", async () => {
    const app = buildApp()
    const body = "small"

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: body.length })
  })

  it("does not block GET requests", async () => {
    const app = buildApp()
    const response = await app.request("/ping", { method: "GET" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it("does not block HEAD requests", async () => {
    const app = buildApp()
    const response = await app.request("/ping", { method: "HEAD" })
    expect(response.status).toBe(200)
  })
})
