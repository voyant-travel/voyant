import { createDbClient, createServerlessDbClient } from "@voyant-travel/db"
import type { NeonDatabase } from "drizzle-orm/neon-serverless"
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres"
import { Pool as NodePgPool } from "pg"

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

export function dbFromEnvForApp(env: CloudflareBindings): {
  db: NeonDatabase
  dispose: () => Promise<void>
} {
  return openDb(env.DATABASE_URL)
}

const httpDbCache = new Map<string, NeonDatabase>()

function parseReplicaUrls(raw: string | undefined, primaryUrl: string): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== primaryUrl)
}

export function httpDbFromEnvForApp(
  env: CloudflareBindings,
): NeonDatabase | ReturnType<typeof openDb> {
  const url = env.DATABASE_URL
  if (isLocalConnection(url)) {
    return openDb(url)
  }
  const replicas = parseReplicaUrls(env.DATABASE_URL_REPLICAS, url)
  const cacheKey = replicas.length > 0 ? `${url}\n${replicas.join(",")}` : url
  let db = httpDbCache.get(cacheKey)
  if (!db) {
    db = createDbClient(
      url,
      replicas.length > 0 ? { adapter: "edge", replicas } : { adapter: "edge" },
    ) as never
    httpDbCache.set(cacheKey, db)
  }
  return db
}
