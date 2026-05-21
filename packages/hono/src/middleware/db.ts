import { dbSupportsTransactions } from "@voyantjs/db/transaction-capability"
import type { MiddlewareHandler } from "hono"

import {
  type DbFactory,
  resolveDbFactoryResult,
  type VoyantBindings,
  type VoyantDb,
} from "../types.js"

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
  let txCapabilityVerified = false
  return async (c, next) => {
    const result = factory(c.env)
    const { db, dispose } = resolveDbFactoryResult(result)
    if (!txCapabilityVerified && requiresTx.length > 0) {
      if (dbSupportsTransactions(db) === false) {
        if (dispose) {
          try {
            await dispose()
          } catch {
            // swallow dispose errors — the original throw is the actionable one
          }
        }
        throw buildIncapableDbError(requiresTx)
      }
      txCapabilityVerified = true
    }
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
