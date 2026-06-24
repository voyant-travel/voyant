import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  MAX_GLOBAL_REQUEST_BODY_BYTES,
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

  it("the global outer ceiling stays at/above the 25 MiB upload allowance", () => {
    // Guards the upload regression: the app-wide guard must never reject a body
    // the media upload route (25 MiB file + multipart envelope) legitimately
    // accepts. Lowering this below the upload cap would 413 valid uploads.
    expect(MAX_GLOBAL_REQUEST_BODY_BYTES).toBeGreaterThanOrEqual(25 * 1024 * 1024)
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

describe("requestBodyLimit content-type-aware caps", () => {
  function buildSplitApp() {
    const app = new Hono()
    app.use("*", requestBodyLimit({ maxBytes: 100, jsonMaxBytes: 16 }))
    app.post("/echo", async (c) => {
      const body = await c.req.text()
      return c.json({ received: body.length })
    })
    app.get("/ping", (c) => c.json({ ok: true }))
    return app
  }

  it("rejects a JSON body that exceeds the tighter jsonMaxBytes cap (regression guard)", async () => {
    // The #2229 fix raised the outer ceiling to 26 MiB; this guards that JSON
    // bodies still get the tighter parseJsonBody-equivalent cap (voyant#2114).
    const app = buildSplitApp()
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(20),
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "request_body_too_large", maxBytes: 16 })
  })

  it("passes a JSON body under the jsonMaxBytes cap", async () => {
    const app = buildSplitApp()
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(8),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: 8 })
  })

  it("treats application/json; charset=utf-8 as JSON (capped at jsonMaxBytes)", async () => {
    const app = buildSplitApp()
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: "x".repeat(20),
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "request_body_too_large", maxBytes: 16 })
  })

  it("does NOT cap a non-JSON body at jsonMaxBytes (uses the outer ceiling)", async () => {
    const app = buildSplitApp()
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x".repeat(50),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: 50 })
  })

  it("rejects a non-JSON body that exceeds the outer maxBytes ceiling", async () => {
    const app = buildSplitApp()
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x".repeat(120),
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "request_body_too_large", maxBytes: 100 })
  })

  it("does not block GET requests when both caps are set", async () => {
    const app = buildSplitApp()
    const response = await app.request("/ping", { method: "GET" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it("clamps the JSON cap to maxBytes so a tighter outer override also tightens JSON", async () => {
    // Deployment override: a global maxBytes (8) below the JSON default (16).
    // JSON must be capped at the lower 8, not silently left at 16.
    const app = new Hono()
    app.use("*", requestBodyLimit({ maxBytes: 8, jsonMaxBytes: 16 }))
    app.post("/echo", async (c) => c.json({ received: (await c.req.text()).length }))

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(12),
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "request_body_too_large", maxBytes: 8 })
  })
})
