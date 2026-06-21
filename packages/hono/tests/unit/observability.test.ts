import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { handleApiError, requestId } from "../../src/middleware/error-boundary.js"
import { logger } from "../../src/middleware/logger.js"
import type { ErrorEvent, Reporter } from "../../src/observability/reporter.js"
import { consoleReporter, noopReporter } from "../../src/observability/reporter.js"
import { getRequestId } from "../../src/observability/request-context.js"
import { ApiHttpError } from "../../src/validation.js"

describe("requestId middleware + getRequestId()", () => {
  it("mints an id, sets X-Request-Id, and exposes it via getRequestId()", async () => {
    const app = new Hono()
    app.use("*", requestId)
    let seen: string | undefined
    app.get("/ok", (c) => {
      seen = getRequestId()
      return c.json({ ok: true })
    })

    const res = await app.request("https://api.example/ok")
    const header = res.headers.get("X-Request-Id")

    expect(header).toMatch(/^[0-9a-f]{32}$/)
    expect(seen).toBe(header)
  })

  it("honors a trusted inbound x-request-id", async () => {
    const app = new Hono()
    app.use("*", requestId)
    let seen: string | undefined
    app.get("/ok", (c) => {
      seen = getRequestId()
      return c.json({ ok: true })
    })

    const inbound = "abc123def456"
    const res = await app.request("https://api.example/ok", {
      headers: { "x-request-id": inbound },
    })

    expect(res.headers.get("X-Request-Id")).toBe(inbound)
    expect(seen).toBe(inbound)
  })

  it("isolates the id per concurrent request", async () => {
    const app = new Hono()
    app.use("*", requestId)
    app.get("/echo", async (c) => {
      // Yield so the two requests interleave inside the async-context store.
      await new Promise((r) => setTimeout(r, 1))
      return c.json({ id: getRequestId() })
    })

    const [a, b] = await Promise.all([
      app
        .request("https://api.example/echo", { headers: { "x-request-id": "req-a" } })
        .then((r) => r.json()),
      app
        .request("https://api.example/echo", { headers: { "x-request-id": "req-b" } })
        .then((r) => r.json()),
    ])

    expect(a).toEqual({ id: "req-a" })
    expect(b).toEqual({ id: "req-b" })
  })

  it("returns undefined outside any request context", () => {
    expect(getRequestId()).toBeUndefined()
  })
})

describe("Reporter seam via handleApiError", () => {
  function appWithReporter(reporter: Reporter, appName?: string) {
    const app = new Hono()
    app.use("*", requestId)
    app.onError((err, c) => handleApiError(err, c, { reporter, appName }))
    app.get("/boom", () => {
      throw new Error("kaboom")
    })
    app.get("/bad", () => {
      throw new ApiHttpError("nope", { status: 422, code: "unprocessable" })
    })
    return app
  }

  it("captures a normalized event for 5xx, with the same requestId as the header", async () => {
    const events: ErrorEvent[] = []
    const reporter: Reporter = {
      captureException: (e) => {
        events.push(e)
      },
    }
    const app = appWithReporter(reporter, "test-app")

    const res = await app.request("https://api.example/boom", {
      headers: { "x-request-id": "trace-xyz" },
    })
    const body = (await res.json()) as { requestId?: string }

    expect(res.status).toBe(500)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      requestId: "trace-xyz",
      app: "test-app",
      context: { path: "/boom", method: "GET", status: 500 },
    })
    expect(events[0].error).toBeInstanceOf(Error)
    // The id surfaced to the user IS the lookup key on the event.
    expect(body.requestId).toBe("trace-xyz")
    expect(res.headers.get("X-Request-Id")).toBe("trace-xyz")
  })

  it("does not report handled 4xx", async () => {
    const capture = vi.fn()
    const app = appWithReporter({ captureException: capture })

    const res = await app.request("https://api.example/bad")

    expect(res.status).toBe(422)
    expect(capture).not.toHaveBeenCalled()
  })

  it("never lets a throwing reporter break the response", async () => {
    const app = appWithReporter({
      captureException: () => {
        throw new Error("reporter blew up")
      },
    })

    const res = await app.request("https://api.example/boom")
    expect(res.status).toBe(500)
  })

  it("defaults to the no-op reporter when none is configured", async () => {
    const app = new Hono()
    app.use("*", requestId)
    app.onError((err, c) => handleApiError(err, c))
    app.get("/boom", () => {
      throw new Error("kaboom")
    })

    const res = await app.request("https://api.example/boom")
    expect(res.status).toBe(500)
  })
})

describe("built-in reporters", () => {
  it("noopReporter swallows events", () => {
    expect(() =>
      noopReporter.captureException({ requestId: "x", app: "y", error: new Error("z") }),
    ).not.toThrow()
  })

  it("consoleReporter writes one structured line", () => {
    const error = vi.fn()
    const reporter = consoleReporter({ error })

    reporter.captureException({
      requestId: "rid",
      app: "app",
      error: new Error("boom"),
      context: { path: "/x" },
    })

    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(
      "[voyant:exception]",
      expect.objectContaining({
        requestId: "rid",
        app: "app",
        error: "boom",
        context: { path: "/x" },
      }),
    )
  })
})

describe("logger carries the requestId", () => {
  it("includes the ambient requestId in the log entry", async () => {
    const entries: Array<{ requestId?: string }> = []
    const app = new Hono()
    app.use("*", requestId)
    app.use("*", logger({ log: (e) => entries.push(e) }))
    app.get("/ok", (c) => c.json({ ok: true }))

    await app.request("https://api.example/ok", { headers: { "x-request-id": "log-me" } })

    expect(entries).toHaveLength(1)
    expect(entries[0].requestId).toBe("log-me")
  })
})
