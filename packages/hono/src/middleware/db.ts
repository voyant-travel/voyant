import type { MiddlewareHandler } from "hono"

import {
  type DbFactory,
  resolveDbFactoryResult,
  type VoyantBindings,
  type VoyantDb,
} from "../types.js"

/**
 * Structural shape of the Cloudflare Workers `ExecutionContext`. Defined
 * inline so the `@voyantjs/hono` package doesn't need a hard dependency on
 * `@cloudflare/workers-types` — consumers running on Node, Vercel, or any
 * other runtime can call this middleware without pulling those globals.
 */
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Resolves the per-request db client and stores it on Hono context.
 *
 * If the factory returns a {@link DisposableDb} (e.g. a
 * `dbFromEnvForApp` that owns a per-request Neon WebSocket Pool), the
 * middleware schedules `dispose()` via `c.executionCtx.waitUntil` so
 * the Pool closes cleanly after the response is sent. Without the
 * scheduled dispose every request would leak its Pool until isolate
 * teardown, which at scale exhausts Neon's connection budget.
 *
 * Factories that return a plain {@link VoyantDb} (e.g. a long-lived
 * postgres-js client cached at the module level) are wired up as
 * before with no cleanup hook.
 */
export function db<TBindings extends VoyantBindings>(
  factory: DbFactory<TBindings>,
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: { db: VoyantDb }
}> {
  return async (c, next) => {
    const result = factory(c.env)
    const { db, dispose } = resolveDbFactoryResult(result)
    if (dispose) {
      c.set("db", db)
      try {
        await next()
      } finally {
        // `executionCtx` is undefined in unit-test contexts where Hono
        // is invoked directly without a Workers runtime — fall back to
        // an inline await so cleanup still runs.
        const ctx = c.executionCtx as ExecutionContextLike | undefined
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(dispose())
        } else {
          await dispose()
        }
      }
      return
    }
    c.set("db", db)
    await next()
  }
}
