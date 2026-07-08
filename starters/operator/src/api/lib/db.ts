import { createDbClient, createServerlessDbClient } from "@voyant-travel/db"
import type { NeonDatabase } from "drizzle-orm/neon-serverless"
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres"
import { Pool as NodePgPool } from "pg"

/**
 * Local Postgres doesn't speak Neon's WebSocket protocol. When the
 * connection string points at localhost, swap the WS driver for
 * `pg.Pool` + `drizzle-orm/node-postgres`. Drizzle's runtime API
 * (queries, transactions) is identical across the two flavors, so we
 * keep the `NeonDatabase` annotation that
 * downstream call sites depend on.
 */
function isLocalConnection(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}

function openDb(connectionString: string): {
  db: NeonDatabase
  dispose: () => Promise<void>
} {
  if (isLocalConnection(connectionString)) {
    const pool = new NodePgPool({ connectionString })
    return {
      db: drizzleNodePg(pool) as never,
      dispose: () => pool.end().catch(() => {}),
    }
  }
  return createServerlessDbClient(connectionString)
}

/**
 * Resident pooled node-postgres client for the Node runtime (voyant#2966).
 *
 * When `DATABASE_URL_DIRECT` is set the operator runs as a long-lived Node
 * process (Cloud Run), so instead of the serverless neon-http/WS clients we keep
 * ONE process-wide pooled client (`adapter: "node"` → postgres-js) against the
 * direct Postgres endpoint. postgres-js supports real transactions, so this
 * single pool serves both the default and transactional factories. `dispose`
 * is a no-op — the pool is shared and lives for the process, not per request.
 *
 * Cached by connection string so a config change yields a fresh pool.
 */
let nodePooledSingleton: { db: NeonDatabase; url: string } | undefined
function nodePooledDb(url: string): NeonDatabase {
  if (nodePooledSingleton?.url !== url) {
    // Drizzle's runtime API is identical across flavors; downstream call sites
    // are typed against `NeonDatabase` (see `openDb`'s rationale).
    nodePooledSingleton = { db: createDbClient(url, { adapter: "node" }) as never, url }
  }
  return nodePooledSingleton.db
}

const noopDispose = async (): Promise<void> => {}

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
export function getDbFromEnv(env: AppBindings): NeonDatabase {
  // Node runtime: hand back the resident pooled client so callers that ignore
  // the disposer (framework-injected `resolveDb` for legal/notifications, etc.)
  // don't leak a per-call pool in the long-lived process. See the direct lane
  // in `dbFromEnvForApp`.
  if (env.DATABASE_URL_DIRECT) {
    return nodePooledDb(env.DATABASE_URL_DIRECT)
  }
  return openDb(env.DATABASE_URL).db
}

/**
 * Lifecycle-aware factory for `createApp({ dbTransactional })`. Returns
 * the drizzle client plus a `dispose()` the Hono db middleware schedules
 * via `executionCtx.waitUntil` after the response is sent — so each
 * request gets its own Pool and closes it before the isolate sleeps,
 * instead of leaking WebSocket connections to Neon at request rate.
 *
 * This is the TRANSACTIONAL factory: the WebSocket client is the only
 * Workers-compatible flavor that supports `db.transaction(...)`, but it
 * pays a full TLS+auth handshake per request. Surfaces that never open
 * interactive transactions are served by {@link httpDbFromEnvForApp}.
 */
export function dbFromEnvForApp(env: AppBindings): {
  db: NeonDatabase
  dispose: () => Promise<void>
} {
  if (env.DATABASE_URL_DIRECT) {
    return { db: nodePooledDb(env.DATABASE_URL_DIRECT), dispose: noopDispose }
  }
  return openDb(env.DATABASE_URL)
}

/**
 * Default (non-transactional) factory for `createApp({ db })`: neon-http
 * — every query is one HTTPS fetch to Neon's proxy, with NO per-request
 * connection handshake and no dispose lifecycle. Cannot run
 * `db.transaction(...)`; `createApp` routes transactional surfaces to
 * {@link dbFromEnvForApp} instead.
 *
 * Cached per isolate + connection string (and replica set — changing
 * `DATABASE_URL_REPLICAS` yields a fresh client): the client is
 * stateless, so unlike the WebSocket Pool it is safe to reuse across
 * requests. Local Postgres doesn't speak Neon's HTTP protocol — local
 * connection strings fall back to the per-request `pg.Pool` path and
 * ignore replicas entirely.
 *
 * Read replicas: when `DATABASE_URL_REPLICAS` is set (comma-separated
 * same-region Neon read replicas), reads round-robin across replicas
 * via drizzle's `withReplicas`; writes and `db.$primary` go to the
 * primary. Replicas are eventually consistent (typically ms of lag),
 * so a request that writes and then reads the same data through this
 * client may read a slightly stale replica — surfaces needing strict
 * read-your-writes should read via `db.$primary` or live on the
 * transactional client ({@link dbFromEnvForApp}), which always talks
 * to the primary.
 */
const httpDbCache = new Map<string, NeonDatabase>()

/**
 * Parse a comma-separated replica connection-string list: trims entries,
 * drops empties, and drops entries equal to the primary URL (a replica
 * pointing at the primary would silently defeat the read split).
 * Exported for unit testing.
 */
export function parseReplicaUrls(raw: string | undefined, primaryUrl: string): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== primaryUrl)
}

export function httpDbFromEnvForApp(env: AppBindings): NeonDatabase | ReturnType<typeof openDb> {
  // Node runtime: serve every request from the resident pooled node-postgres
  // client against the direct endpoint (voyant#2966). Takes precedence over the
  // neon-http lane below, which is the Workers/serverless adapter.
  if (env.DATABASE_URL_DIRECT) {
    return nodePooledDb(env.DATABASE_URL_DIRECT)
  }
  const url = env.DATABASE_URL
  if (isLocalConnection(url)) {
    return openDb(url)
  }
  const replicas = parseReplicaUrls(env.DATABASE_URL_REPLICAS, url)
  const cacheKey = replicas.length > 0 ? `${url}\n${replicas.join(",")}` : url
  let db = httpDbCache.get(cacheKey)
  if (!db) {
    // Drizzle's runtime API is identical across flavors; downstream call
    // sites are typed against `NeonDatabase` (see `openDb`'s rationale).
    db = createDbClient(
      url,
      replicas.length > 0 ? { adapter: "edge", replicas } : { adapter: "edge" },
    ) as never
    httpDbCache.set(cacheKey, db)
  }
  return db
}

/**
 * Higher-order helper for code paths without a Hono request context
 * (event-bus subscribers, scheduled handlers, retry workers). Owns
 * the Pool lifecycle: opens, hands the drizzle client to `fn`, closes
 * on settle.
 */
export async function withDbFromEnv<T>(
  env: AppBindings,
  fn: (db: NeonDatabase) => Promise<T>,
): Promise<T> {
  // Node runtime: reuse the resident pooled client (no per-call open/close).
  if (env.DATABASE_URL_DIRECT) {
    return fn(nodePooledDb(env.DATABASE_URL_DIRECT))
  }
  const { db, dispose } = openDb(env.DATABASE_URL)
  try {
    return await fn(db)
  } finally {
    await dispose()
  }
}
