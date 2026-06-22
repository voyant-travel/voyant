import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Async-context store carrying the per-request correlation id (RFC #1553,
 * primitive 1). The `requestId` middleware mints/propagates the id and runs the
 * remainder of the request inside {@link runWithRequestId}, so any code on that
 * async call stack — services, event subscribers, error reporters — can read it
 * via {@link getRequestId} without threading it through every signature or
 * reaching for the Hono `Context`. This is the single correlation key shared by
 * the `X-Request-Id` response header, app logs, and emitted error events.
 *
 * Requires the `nodejs_compat` (or `nodejs_als`) compatibility flag on
 * Cloudflare Workers; native on Node.
 */
const requestIdStore = new AsyncLocalStorage<string>()

/**
 * Run `fn` (and everything it awaits) with `id` bound as the ambient request
 * id. Returns whatever `fn` returns — for the middleware, the `next()` promise.
 */
export function runWithRequestId<T>(id: string, fn: () => T): T {
  return requestIdStore.run(id, fn)
}

/**
 * Read the ambient request id for the current async context, or `undefined`
 * when called outside a request (or on a runtime without async_hooks). Access
 * is defensive: it never throws, so callers can safely fall back to a context
 * variable or header.
 */
export function getRequestId(): string | undefined {
  try {
    return requestIdStore.getStore()
  } catch {
    return undefined
  }
}
