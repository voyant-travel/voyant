/**
 * Normalized error event emitted at every framework catch point (RFC #1553,
 * primitive 2). `requestId` is the same correlation id surfaced to the end user
 * and set on the `X-Request-Id` response header, so an operator can paste a
 * user-reported reference straight into their telemetry backend and find the
 * crash — the gap this RFC was filed to close.
 */
export interface ErrorEvent {
  /** Correlation id minted/propagated by the `requestId` middleware. */
  requestId: string
  /** Logical app/worker name, from `VoyantAppConfig.appName` (default `"voyant"`). */
  app: string
  /** The thrown value. Adapters typically narrow with `instanceof Error`. */
  error: unknown
  /** Request/operation metadata (path, method, status, code, …). */
  context?: Record<string, unknown>
}

/**
 * The observability seam. A deployment registers ONE reporter (via
 * `VoyantAppConfig.reporter`) that forwards normalized {@link ErrorEvent}s to
 * its backend of choice — Sentry, OpenTelemetry, Datadog, console, or nothing.
 * The framework owns the catch points and the event shape; the sink is a
 * deployment decision. Implementations MUST NOT throw and SHOULD return quickly
 * (returning a promise the runtime flushes via `waitUntil`) — capture is
 * best-effort and must never mask the original error or block the response.
 */
export interface Reporter {
  captureException(event: ErrorEvent): void | Promise<void>
}

/**
 * Forward an event to the reporter, defensively. Never throws (a reporter must
 * not break the caller), and when `captureException` returns a promise, flushes
 * it via the optional `waitUntil` (so HTTP catch points don't block the
 * response) or lets it settle detached otherwise. The context-free counterpart
 * to the HTTP `reportException` helper — used by non-request catch points
 * (bootstrap, event-bus subscribers, scheduled jobs) where there is no `Context`.
 */
export function safeCaptureException(
  reporter: Reporter,
  event: ErrorEvent,
  waitUntil?: (promise: Promise<unknown>) => void,
): void {
  let result: void | Promise<void>
  try {
    result = reporter.captureException(event)
  } catch {
    return
  }
  if (result && typeof (result as Promise<void>).then === "function") {
    const settled = (result as Promise<void>).catch(() => {})
    if (waitUntil) waitUntil(settled)
    else void settled
  }
}

/**
 * Default reporter: drops every event. Zero vendor coupling out of the box — a
 * deployment opts in by supplying its own {@link Reporter}. The no-op default
 * must stay a valid choice (RFC #1553 §5).
 */
export const noopReporter: Reporter = {
  captureException() {
    // intentionally empty
  },
}

/**
 * Built-in reporter that writes one structured line per exception to
 * `console.error` (tagged `[voyant:exception]`). Useful for local dev and for
 * deployments whose log drain *is* their telemetry backend, without pulling in
 * a vendor SDK. Never throws.
 */
export function consoleReporter(sink: Pick<Console, "error"> = console): Reporter {
  return {
    captureException(event) {
      try {
        const { requestId, app, error, context } = event
        sink.error("[voyant:exception]", {
          requestId,
          app,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ...(context ? { context } : {}),
        })
      } catch {
        // a reporter must never break the response
      }
    },
  }
}
