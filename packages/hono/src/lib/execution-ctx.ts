/**
 * Structural shape of the Cloudflare Workers `ExecutionContext`. Defined
 * locally so `@voyantjs/hono` doesn't need `@cloudflare/workers-types` —
 * consumers on Node, Vercel, or any other runtime can use these helpers.
 */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Hono throws on `executionCtx` access when the adapter provides none
 * (Node tests, some serverless adapters) — normalize to undefined.
 */
export function tryGetExecutionCtx(c: {
  executionCtx?: unknown
}): ExecutionContextLike | undefined {
  try {
    const ctx = c.executionCtx as { waitUntil?: unknown } | undefined
    if (ctx && typeof ctx.waitUntil === "function") {
      return ctx as ExecutionContextLike
    }
  } catch {
    // no ExecutionContext on this runtime
  }
  return undefined
}
