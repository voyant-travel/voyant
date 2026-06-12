import type { MiddlewareHandler } from "hono"

import type { VoyantVariables } from "../types.js"

/**
 * Structural shape of a Workers Analytics Engine dataset binding —
 * declared locally so `@voyantjs/hono` needs no `@cloudflare/workers-types`
 * dependency.
 */
export interface AnalyticsEngineDatasetLike {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
}

/** Per-request db-query counter, populated by the db middleware. */
export interface RequestDbMetrics {
  queries: number
}

export const DB_METRICS_CONTEXT_KEY = "__voyantDbMetrics"

export interface MetricsMiddlewareOptions {
  /**
   * Resolve the Analytics Engine dataset from bindings. Defaults to
   * `env.METRICS`. Returning undefined makes the middleware a no-op for
   * that request (deployments without the binding pay ~nothing).
   */
  dataset?: (env: unknown) => AnalyticsEngineDatasetLike | undefined
}

function surfaceOf(path: string): string {
  if (path.startsWith("/v1/admin/")) return "admin"
  if (path.startsWith("/v1/public/")) return "public"
  if (path.startsWith("/v1/")) return "legacy"
  return "other"
}

/**
 * Per-request metrics → Workers Analytics Engine (RFC voyant#1687 Phase
 * 3.4, the in-worker half — the platform dispatcher's DISPATCH_METRICS
 * dataset already records hostname/plan/cache/duration per dispatch;
 * this adds what only the worker can see: the matched route pattern,
 * the db query count, and in-worker cache hits).
 *
 * One data point per request:
 * - blobs:   [method, routePattern, surface, cacheStatus]
 * - doubles: [durationMs, status, dbQueryCount]
 * - indexes: [routePattern]  (AE sampling key — per-route analysis)
 *
 * `writeDataPoint` is fire-and-forget and never throws into the
 * request; a missing binding short-circuits before timing overhead.
 */
export function metrics(options: MetricsMiddlewareOptions = {}): MiddlewareHandler<{
  Variables: Pick<VoyantVariables, typeof DB_METRICS_CONTEXT_KEY>
}> {
  const resolveDataset =
    options.dataset ??
    ((env: unknown) => (env as { METRICS?: AnalyticsEngineDatasetLike } | undefined)?.METRICS)

  return async (c, next) => {
    const dataset = resolveDataset(c.env)
    if (!dataset || typeof dataset.writeDataPoint !== "function") {
      return next()
    }

    const counter: RequestDbMetrics = { queries: 0 }
    c.set(DB_METRICS_CONTEXT_KEY, counter)

    const start = Date.now()
    try {
      await next()
    } finally {
      const durationMs = Date.now() - start
      const routePattern = c.req.routePath ?? c.req.path
      const status = c.res?.status ?? 0
      const cacheStatus = c.res?.headers.get("x-voyant-cache") ?? ""
      try {
        dataset.writeDataPoint({
          blobs: [c.req.method, routePattern, surfaceOf(c.req.path), cacheStatus],
          doubles: [durationMs, status, counter.queries],
          indexes: [routePattern.slice(0, 96)],
        })
      } catch {
        // metrics are observability, never a request failure
      }
    }
  }
}

/**
 * Wrap a drizzle client so top-level query-initiating calls increment
 * the request counter. Counts `select/insert/update/delete/execute/
 * transaction/query` invocations — a transaction counts as ONE (its
 * inner statements run on the tx handle, which is not wrapped). An
 * approximation by design: the goal is spotting N+1 routes and
 * subrequest-budget pressure, not exact accounting.
 */
export function withQueryCounting<TDb extends object>(db: TDb, counter: RequestDbMetrics): TDb {
  const counted = new Set([
    "select",
    "selectDistinct",
    "insert",
    "update",
    "delete",
    "execute",
    "transaction",
    "query",
  ])
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, target)
      if (typeof value === "function" && typeof prop === "string" && counted.has(prop)) {
        return (...args: unknown[]) => {
          counter.queries += 1
          return (value as (...a: unknown[]) => unknown).apply(target, args)
        }
      }
      if (typeof value === "function") {
        // Preserve `this` for drizzle internals (incl. #private fields).
        return (value as (...a: unknown[]) => unknown).bind(target)
      }
      void receiver
      return value
    },
  }) as TDb
}
