/**
 * Minimal structural slice of the Cloudflare `ExecutionContext`. Only
 * `waitUntil` is required by this package; the full context object is passed
 * through to apps untouched, so any richer context type remains compatible.
 */
export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Anything with a Worker-style `fetch` — a Hono app, a Better Auth handler,
 * or a plain `{ fetch }` module default export.
 */
export interface FetchApp<Env = unknown, Ctx extends WaitUntilContext = WaitUntilContext> {
  fetch(request: Request, env?: Env, ctx?: Ctx): Response | Promise<Response>
}

/**
 * Lazily resolves a {@link FetchApp}. Loaders own the dynamic `import()` of
 * app modules so the Worker entry stays out of the API graph until a request
 * actually needs it.
 */
export type AppLoader<
  Env = unknown,
  Ctx extends WaitUntilContext = WaitUntilContext,
> = () => Promise<FetchApp<Env, Ctx>>

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
 * an operator app exports; the whole point of this package is that the same
 * handler runs unchanged on Node via {@link createNodeServer}.
 */
export type FetchHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
) => Response | Promise<Response>

/**
 * The event object passed to a Worker `scheduled()` handler. On Node targets the
 * scheduler dispatch arrives over HTTP, so `scheduledTime` is the dispatch time.
 * New dispatchers identify jobs by stable `scheduleId`; `cron` remains optional
 * for Workers compatibility and legacy Cloud Scheduler URLs.
 */
export interface ScheduledEventLike {
  scheduleId?: string
  cron?: string
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
