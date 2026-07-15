import type { MiddlewareHandler } from "hono"

/** Structural sink contract for request metrics. */
export interface AnalyticsEngineDatasetLike {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
}

/** Per-request db-query counter, populated by the db middleware. */
export interface RequestDbMetrics {
  queries: number
}

export const DB_METRICS_CONTEXT_KEY = "__voyantDbMetrics"

export interface MetricsMiddlewareOptions {
  /** Resolve the metrics sink for a request. Returning undefined is a no-op. */
  dataset: (env: unknown) => AnalyticsEngineDatasetLike | undefined
}

function surfaceOf(path: string): string {
  if (path.startsWith("/v1/admin/")) return "admin"
  if (path.startsWith("/v1/public/")) return "public"
  if (path.startsWith("/v1/")) return "legacy"
  return "other"
}

/**
 * Per-request metrics for an explicitly supplied deployment sink.
 *
 * One data point per request:
 * - blobs:   [method, routePattern, surface, cacheStatus]
 * - doubles: [durationMs, status, dbQueryCount]
 * - indexes: [routePattern]  (AE sampling key — per-route analysis)
 *
 * `writeDataPoint` is fire-and-forget and never throws into the
 * request; a missing binding short-circuits before timing overhead.
 */
export function metrics(
  options: MetricsMiddlewareOptions,
): MiddlewareHandler<{ Variables: { [DB_METRICS_CONTEXT_KEY]?: RequestDbMetrics } }> {
  const resolveDataset = options.dataset

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
