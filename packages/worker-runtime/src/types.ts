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
