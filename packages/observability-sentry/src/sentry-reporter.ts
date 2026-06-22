import type { ErrorEvent, Reporter } from "@voyant-travel/hono/observability"

/**
 * The slice of a Sentry SDK this adapter calls. Declared structurally so the
 * adapter binds to ANY Sentry flavour — `@sentry/cloudflare`, `@sentry/node`,
 * `@sentry/bun`, `@sentry/browser` — and any version whose `captureException`
 * accepts a capture-context hint, without this package taking a hard dependency
 * on a specific Sentry SDK. The deployment owns `init`/DSN/transport/sampling;
 * the adapter only maps the normalized event and forwards it. This is exactly
 * the split RFC voyant#1553 asked for: the framework owns the catch points and
 * event shape, the vendor SDK stays a deployment choice.
 */
export interface SentryLike {
  captureException(exception: unknown, hint?: SentryCaptureContext): string
  /**
   * Optional. On Cloudflare Workers, Sentry buffers events and only delivers
   * them on `flush`; when the client exposes it, the adapter returns
   * `flush(timeout)` so the framework drains it via `ctx.waitUntil` after the
   * response. Owning this lifecycle once is the point — the three hand-rolled
   * `sentry.ts` copies the RFC cites each got the manual `flush`/`waitUntil`
   * dance subtly wrong, and server-side Worker exceptions never delivered.
   */
  flush?(timeout?: number): Promise<boolean>
}

/** The subset of Sentry's capture-context hint this adapter populates. */
export interface SentryCaptureContext {
  tags?: Record<string, string>
  contexts?: Record<string, Record<string, unknown>>
}

export interface SentryReporterOptions {
  /**
   * Tag key carrying the correlation id. Default `"request_id"`. This is the
   * tag that makes a user-reported reference findable in Sentry — closing the
   * RFC's root cause, where the id surfaced to the user never reached the event.
   */
  requestIdTag?: string
  /** Tag key carrying the logical app/worker name. Default `"app"`. */
  appTag?: string
  /**
   * Sentry context group the normalized `ErrorEvent.context` is nested under
   * (shows as a labelled section on the issue). Default `"voyant"`.
   */
  contextKey?: string
  /**
   * Flush after every capture. Workers must (events are buffered until flush);
   * long-lived Node/Bun servers need not. Default: flush when the client
   * exposes a `flush` method.
   */
  flush?: boolean
  /** Flush timeout in milliseconds. Default `2000` (matches Sentry's own). */
  flushTimeoutMs?: number
}

/**
 * Build a {@link Reporter} backed by an already-initialized Sentry client.
 *
 * Register it once on `VoyantAppConfig.reporter` and every framework catch
 * point (5xx boundary, auth sub-app, module bootstrap, event-bus subscribers,
 * scheduled jobs) routes its {@link ErrorEvent} to Sentry — each tagged with
 * the same `requestId` the user sees on `X-Request-Id`, so a support reference
 * is a one-paste lookup in the Sentry issue search.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/cloudflare"
 * import { sentryReporter } from "@voyant-travel/observability-sentry"
 *
 * const reporter = sentryReporter(Sentry)
 * const app = createApp({ reporter, appName: "operator", modules })
 * ```
 */
export function sentryReporter(sentry: SentryLike, options: SentryReporterOptions = {}): Reporter {
  const requestIdTag = options.requestIdTag ?? "request_id"
  const appTag = options.appTag ?? "app"
  const contextKey = options.contextKey ?? "voyant"
  const flushTimeoutMs = options.flushTimeoutMs ?? 2000
  const shouldFlush = options.flush ?? typeof sentry.flush === "function"

  return {
    captureException(event: ErrorEvent): void | Promise<void> {
      const { requestId, app, error, context } = event

      const tags: Record<string, string> = { [appTag]: app }
      // Only tag a non-empty id. Background/scheduled catch points emit an empty
      // requestId (no request to correlate with), and an empty-string tag is
      // searchable noise rather than a useful key.
      if (requestId) tags[requestIdTag] = requestId

      sentry.captureException(toError(error), {
        tags,
        contexts: context ? { [contextKey]: context } : undefined,
      })

      if (shouldFlush && sentry.flush) {
        // Handed back to the framework, which drains it via `waitUntil` so the
        // buffered event delivers without blocking the response. `.then`
        // collapses the boolean to the `void` the Reporter contract expects.
        return sentry.flush(flushTimeoutMs).then(() => {})
      }
    },
  }
}

/**
 * Sentry produces the richest issue (stack frames, grouping) from a real
 * `Error`. Pass `Error` instances through untouched; wrap anything else so a
 * thrown string/object still yields a grouped, stack-bearing issue instead of
 * Sentry's bare "Non-Error exception captured" placeholder.
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === "string") return new Error(error)
  try {
    return new Error(`Non-Error thrown: ${JSON.stringify(error)}`)
  } catch {
    // Circular or otherwise un-serializable value.
    return new Error(`Non-Error thrown: ${String(error)}`)
  }
}
