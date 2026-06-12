import { dbSupportsTransactions } from "@voyantjs/db/transaction-capability"
import type { MiddlewareHandler } from "hono"

import { type DbSource, isDbFactorySelector, type VoyantBindings, type VoyantDb } from "../types.js"
import { DB_METRICS_CONTEXT_KEY, type RequestDbMetrics, withQueryCounting } from "./metrics.js"
import { acquireRequestDb } from "./request-db.js"

export interface DbMiddlewareOptions {
  /**
   * Names of modules that require a transaction-capable db adapter
   * (those that set `Module.requiresTransactionalDb`). If non-empty
   * and the first resolved db reports
   * `dbSupportsTransactions(db) === false`, the middleware throws a
   * clear error naming the offending modules. A capability of
   * `undefined` (untagged drivers like raw `drizzle-orm/node-postgres`)
   * is treated as "assume capable" — only an explicit `false`
   * (neon-http) trips the assertion.
   */
  requiresTransactionalDb?: readonly string[]
}

function buildIncapableDbError(modules: readonly string[]): Error {
  const list = [...modules].sort().join(", ")
  return new Error(
    `[voyant] db adapter does not support interactive transactions, but the ` +
      `following modules require it: ${list}. ` +
      `Use createServerlessDbClient (neon-serverless / WebSocket) for ` +
      `Cloudflare Workers, or createDbClient(url, { adapter: "node" }) for ` +
      `Node deployments. The "edge" adapter (neon-http) is read-mostly ` +
      `and cannot run db.transaction(async (tx) => …).`,
  )
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
 *
 * The client is shared per request via {@link acquireRequestDb}: if the
 * auth middleware (which runs earlier) already created one for the same
 * factory, this middleware reuses it instead of opening a second Pool —
 * the creator's `release()` owns the dispose.
 */
export function db<TBindings extends VoyantBindings>(
  source: DbSource<TBindings>,
  options: DbMiddlewareOptions = {},
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: { db: VoyantDb }
}> {
  const requiresTx = options.requiresTransactionalDb ?? []
  // Stays `false` until a request resolves a db whose capability tag is
  // anything other than an explicit `false`. As long as the adapter is
  // wired wrong, every request keeps surfacing the actionable error —
  // we don't want the first failing request to silence subsequent
  // checks and let later writes crash with the deep transaction error.
  //
  // With a DbFactorySelector the assertion is per-surface: only requests
  // the selector routes to the transactional factory must resolve a
  // transaction-capable client — the default (http) factory is allowed,
  // by design, to be transaction-incapable.
  let txCapabilityVerified = false
  return async (c, next) => {
    const selection = isDbFactorySelector(source)
      ? source.select(c.req.path)
      : { factory: source, mustSupportTransactions: requiresTx.length > 0 }
    const lease = acquireRequestDb(c, selection.factory)
    if (!txCapabilityVerified && selection.mustSupportTransactions && requiresTx.length > 0) {
      if (dbSupportsTransactions(lease.db) === false) {
        try {
          await lease.release()
        } catch {
          // swallow dispose errors — the original throw is the actionable one
        }
        throw buildIncapableDbError(requiresTx)
      }
      txCapabilityVerified = true
    }
    // When the metrics middleware put a counter on the context, expose a
    // query-counting view of the client so per-route db-query counts land
    // in Analytics Engine. The lease (and its dispose) stay unwrapped.
    const dbMetrics = (c as unknown as { get(key: string): unknown }).get(DB_METRICS_CONTEXT_KEY) as
      | RequestDbMetrics
      | undefined
    c.set("db", dbMetrics ? withQueryCounting(lease.db, dbMetrics) : lease.db)
    try {
      await next()
    } finally {
      // No-op when the auth middleware created (and therefore owns) the
      // shared client; otherwise schedules dispose via waitUntil (or
      // awaits inline outside Workers).
      await lease.release()
    }
  }
}
