import { Pool } from "@neondatabase/serverless"
import { createDbClient, type DbAdapter } from "@voyantjs/db"
import { drizzle as drizzleNeonWs, type NeonDatabase } from "drizzle-orm/neon-serverless"

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
 * Per-request Neon Postgres client over WebSocket. Supports real
 * Postgres transactions (drizzle's `db.transaction(...)`).
 *
 * Cleanup is the caller's responsibility — either route through
 * `createApp({ db: dbFromEnvForApp })` below (which threads a
 * `dispose()` through the Hono db middleware so the Pool closes after
 * the response), or use `withDbFromEnv` for code paths outside Hono.
 * Without explicit cleanup, the Pool sits open until the Workers
 * runtime reclaims the isolate.
 */
export function getDbFromEnv(env: CloudflareBindings): NeonDatabase {
  const pool = newPool(env.DATABASE_URL)
  return drizzleNeonWs(pool)
}

/**
 * Lifecycle-aware factory for `createApp({ db })`. Returns the drizzle
 * client plus a `dispose()` the Hono db middleware schedules via
 * `executionCtx.waitUntil` after the response is sent — so each
 * request gets its own Pool and closes it before the isolate sleeps,
 * instead of leaking WebSocket connections to Neon at request rate.
 */
export function dbFromEnvForApp(env: CloudflareBindings): {
  db: NeonDatabase
  dispose: () => Promise<void>
} {
  const pool = newPool(env.DATABASE_URL)
  return {
    db: drizzleNeonWs(pool),
    dispose: () => pool.end().catch(() => {}),
  }
}

/**
 * Higher-order helper for code paths without a Hono request context
 * (event-bus subscribers, scheduled handlers, retry workers). Owns
 * the Pool lifecycle: opens, hands the drizzle client to `fn`, closes
 * on settle.
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
