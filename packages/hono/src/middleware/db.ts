import type { MiddlewareHandler } from "hono"

import { type DbFactory, isDisposableDb, type VoyantBindings, type VoyantDb } from "../types.js"

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
    if (isDisposableDb(result)) {
      c.set("db", result.db)
      try {
        await next()
      } finally {
        // `executionCtx` is undefined in unit-test contexts where Hono
        // is invoked directly without a Workers runtime — fall back to
        // an inline await so cleanup still runs.
        const ctx = c.executionCtx as ExecutionContext | undefined
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(result.dispose())
        } else {
          await result.dispose()
        }
      }
      return
    }
    c.set("db", result)
    await next()
  }
}
