import { safeCaptureException } from "@voyant-travel/hono/observability/reporter"
import { describe, expect, it, vi } from "vitest"
import { type SentryCaptureContext, type SentryLike, sentryReporter } from "../src/index.js"

interface Captured {
  exception: unknown
  hint?: SentryCaptureContext
}

/** Minimal in-memory Sentry double recording every capture + flush call. */
function fakeSentry(opts: { withFlush?: boolean } = {}): SentryLike & {
  captured: Captured[]
  flushCalls: number[]
} {
  const captured: Captured[] = []
  const flushCalls: number[] = []
  const sentry: SentryLike & { captured: Captured[]; flushCalls: number[] } = {
    captured,
    flushCalls,
    captureException(exception, hint) {
      captured.push({ exception, hint })
      return "evt_123"
    },
  }
  if (opts.withFlush ?? true) {
    sentry.flush = (timeout?: number) => {
      flushCalls.push(timeout ?? -1)
      return Promise.resolve(true)
    }
  }
  return sentry
}

describe("sentryReporter", () => {
  it("tags the request id and app name onto the captured event", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(sentry.captured).toHaveLength(1)
    expect(sentry.captured[0]?.hint?.tags).toEqual({
      app: "operator",
      request_id: "abc123",
    })
  })

  it("omits the request_id tag when the id is empty (background catch points)", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "",
      app: "operator",
      error: new Error("cron failed"),
    })

    expect(sentry.captured[0]?.hint?.tags).toEqual({ app: "operator" })
    expect(sentry.captured[0]?.hint?.tags).not.toHaveProperty("request_id")
  })

  it("nests the normalized context under the voyant context group", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
      context: { path: "/v1/admin/bookings", method: "POST", status: 500 },
    })

    expect(sentry.captured[0]?.hint?.contexts).toEqual({
      voyant: { path: "/v1/admin/bookings", method: "POST", status: 500 },
    })
  })

  it("omits contexts entirely when there is no context", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(sentry.captured[0]?.hint?.contexts).toBeUndefined()
  })

  it("passes Error instances through untouched (preserving stack)", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)
    const original = new Error("original")

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: original,
    })

    expect(sentry.captured[0]?.exception).toBe(original)
  })

  it("wraps a thrown string into an Error", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: "string failure",
    })

    const captured = sentry.captured[0]?.exception
    expect(captured).toBeInstanceOf(Error)
    expect((captured as Error).message).toBe("string failure")
  })

  it("wraps a thrown non-Error object into a serialized Error", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: { code: "E_NOPE", detail: "weird" },
    })

    const captured = sentry.captured[0]?.exception
    expect(captured).toBeInstanceOf(Error)
    expect((captured as Error).message).toContain("E_NOPE")
  })

  it("wraps a circular non-Error object without throwing", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry)
    const circular: Record<string, unknown> = {}
    circular.self = circular

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: circular,
    })

    expect(sentry.captured[0]?.exception).toBeInstanceOf(Error)
  })

  it("flushes after capture when the client exposes flush, returning the promise", async () => {
    const sentry = fakeSentry({ withFlush: true })
    const reporter = sentryReporter(sentry)

    const result = reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(result).toBeInstanceOf(Promise)
    await result
    expect(sentry.flushCalls).toEqual([2000])
  })

  it("honors a custom flush timeout", async () => {
    const sentry = fakeSentry({ withFlush: true })
    const reporter = sentryReporter(sentry, { flushTimeoutMs: 500 })

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(sentry.flushCalls).toEqual([500])
  })

  it("does not flush when the client has no flush method", () => {
    const sentry = fakeSentry({ withFlush: false })
    const reporter = sentryReporter(sentry)

    const result = reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(result).toBeUndefined()
    expect(sentry.flushCalls).toEqual([])
  })

  it("does not flush when flush is disabled via options", () => {
    const sentry = fakeSentry({ withFlush: true })
    const reporter = sentryReporter(sentry, { flush: false })

    const result = reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
    })

    expect(result).toBeUndefined()
    expect(sentry.flushCalls).toEqual([])
  })

  it("supports custom tag and context keys", async () => {
    const sentry = fakeSentry()
    const reporter = sentryReporter(sentry, {
      requestIdTag: "correlation_id",
      appTag: "service",
      contextKey: "request",
    })

    await reporter.captureException({
      requestId: "abc123",
      app: "operator",
      error: new Error("boom"),
      context: { path: "/x" },
    })

    expect(sentry.captured[0]?.hint?.tags).toEqual({
      service: "operator",
      correlation_id: "abc123",
    })
    expect(sentry.captured[0]?.hint?.contexts).toEqual({ request: { path: "/x" } })
  })

  it("round-trips through the framework's safeCaptureException helper", () => {
    const sentry = fakeSentry({ withFlush: true })
    const reporter = sentryReporter(sentry)
    const waitUntil = vi.fn<(p: Promise<unknown>) => void>()

    // This is how non-request catch points (bootstrap, event-bus, scheduled
    // jobs) drive a reporter: the helper must capture and hand the flush promise
    // to waitUntil without throwing.
    safeCaptureException(
      reporter,
      { requestId: "abc123", app: "operator", error: new Error("boom") },
      waitUntil,
    )

    expect(sentry.captured).toHaveLength(1)
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })

  it("never lets a captureException throw escape safeCaptureException", () => {
    const exploding: SentryLike = {
      captureException() {
        throw new Error("sentry transport exploded")
      },
    }
    const reporter = sentryReporter(exploding)

    expect(() =>
      safeCaptureException(reporter, {
        requestId: "abc123",
        app: "operator",
        error: new Error("boom"),
      }),
    ).not.toThrow()
  })
})
