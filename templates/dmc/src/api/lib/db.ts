import { Pool } from "@neondatabase/serverless"
import { createDbClient, type DbAdapter } from "@voyantjs/db"
import { drizzle as drizzleNeonWs, type NeonDatabase } from "drizzle-orm/neon-serverless"

/**
 * Database client helpers with NO schema passing.
 * Queries import table definitions directly for optimal tree-shaking.
 * All data is in a single EU database - no multi-region routing needed.
 */

export function getDb(adapter?: DbAdapter) {
  const url = process.env.DATABASE_URL ?? ""
  const effectiveAdapter = adapter || (process.env.DB_ADAPTER as DbAdapter) || "edge"
  return createDbClient(url, { adapter: effectiveAdapter })
}

/**
 * `@neondatabase/serverless`'s `Pool` extends `pg.Pool`. Some pnpm
 * resolution paths don't merge the inherited `pg.Pool` methods into
 * the visible TS surface, so the constructor + `end()` call go via
 * a structural cast. Runtime behavior is unchanged.
 */
type PgPoolApi = {
  end(): Promise<void>
}
function newPool(connectionString: string): Pool & PgPoolApi {
  const Ctor = Pool as unknown as new (cfg: { connectionString: string }) => Pool & PgPoolApi
  return new Ctor({ connectionString })
}

/**
 * Per-request Neon Postgres client over WebSocket. Supports real
 * Postgres transactions (drizzle's `db.transaction(...)`).
 *
 * Pool lifecycle: pass `executionCtx` whenever it's available so
 * `pool.end()` is scheduled via `waitUntil` and the WebSocket closes
 * cleanly before the isolate sleeps. Without an `executionCtx`, the
 * Pool is left for the Workers runtime to reclaim on isolate teardown
 * — fine for low-traffic paths, but at scale prefer `withDbFromEnv`
 * below, which owns the Pool lifecycle explicitly.
 */
export function getDbFromEnv(
  env: CloudflareBindings,
  executionCtx?: ExecutionContext,
): NeonDatabase {
  const pool = newPool(env.DATABASE_URL)
  if (executionCtx) {
    executionCtx.waitUntil(pool.end().catch(() => {}))
  }
  return drizzleNeonWs(pool)
}

/**
 * Higher-order helper for code paths without an `ExecutionContext`
 * (event-bus subscribers, scheduled handlers, retry workers). Owns the
 * Pool lifecycle: opens, hands the drizzle client to `fn`, closes on
 * settle. Use this anywhere `c.executionCtx` isn't available — never
 * leak a `new Pool(...)` outside a single request handler in a Worker.
 */
export async function withDbFromEnv<T>(
  env: CloudflareBindings,
  fn: (db: NeonDatabase) => Promise<T>,
): Promise<T> {
  const pool = newPool(env.DATABASE_URL)
  try {
    return await fn(drizzleNeonWs(pool))
  } finally {
    await pool.end().catch(() => {})
  }
}
