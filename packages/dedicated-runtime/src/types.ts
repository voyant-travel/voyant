import type { WaitUntilContext } from "@voyant-travel/worker-runtime/types"

/**
 * Structural slice of the Cloudflare Workers `ExecutionContext`. On a resident
 * Node process we can ship a *real* {@link ExecutionContextLike.waitUntil} that
 * tracks background work for graceful shutdown, instead of running subscriber
 * work inline (which adds request latency) or dropping it on exit.
 */
export interface ExecutionContextLike extends WaitUntilContext {
  /**
   * No-op on Node — kept for source-compatibility with app code that calls
   * `ctx.passThroughOnException()` on Workers.
   */
  passThroughOnException?(): void
}

/**
 * Worker-style `fetch(request, env, ctx)` entrypoint. This is the exact shape
 * an operator app exports on Cloudflare Workers; the whole point of this
 * package is that the same handler runs unchanged on Node.
 */
export type FetchHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
) => Response | Promise<Response>

/**
 * The event object passed to a Worker `scheduled()` handler. On Cloud Run the
 * cron triggers arrive over HTTP (Cloud Scheduler), so `scheduledTime` is the
 * dispatch time and `cron` is echoed from the request.
 */
export interface ScheduledEventLike {
  cron: string
  scheduledTime: number
}

/**
 * Worker-style `scheduled(event, env, ctx)` handler.
 */
export type ScheduledHandler<Env> = (
  event: ScheduledEventLike,
  env: Env,
  ctx: ExecutionContextLike,
) => void | Promise<void>
