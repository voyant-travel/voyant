import { neon } from "@neondatabase/serverless"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { withReplicas } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export type DbAdapter = "edge" | "node"

/**
 * Union of the two drizzle driver flavors `createDbClient` can return —
 * `PostgresJsDatabase` (node adapter) and `NeonHttpDatabase` (edge adapter).
 * Use this as the parameter type for `resolveDb`-style callbacks in module
 * factories so consumers don't need `as unknown as PostgresJsDatabase` casts
 * when wiring a Cloudflare Worker / Hyperdrive client into a module.
 */
export type AnyDrizzleDb<TSchema extends Record<string, unknown> = Record<string, never>> =
  | PostgresJsDatabase<TSchema>
  | NeonHttpDatabase<TSchema>

export function createDbClient<TSchema extends Record<string, unknown> = Record<string, never>>(
  connectionString: string,
  options?: {
    schema?: TSchema
    adapter?: DbAdapter
    replicas?: string[]
    nodeMaxConnections?: number
  },
) {
  const {
    adapter = (process.env.DB_ADAPTER as DbAdapter) || "edge",
    schema,
    replicas = [],
    nodeMaxConnections,
  } = options || {}

  if (adapter === "node") {
    const client = postgres(connectionString, nodeMaxConnections ? { max: nodeMaxConnections } : {})
    const primary = schema ? drizzlePostgres(client, { schema }) : drizzlePostgres(client)

    if (replicas.length === 0) {
      return primary
    }

    const replicaInstances = replicas.map((replicaUrl) => {
      const replicaClient = postgres(
        replicaUrl,
        nodeMaxConnections ? { max: nodeMaxConnections } : {},
      )
      return schema ? drizzlePostgres(replicaClient, { schema }) : drizzlePostgres(replicaClient)
    })
    const [firstReplica, ...otherReplicas] = replicaInstances
    if (firstReplica) {
      return withReplicas(primary, [firstReplica, ...otherReplicas])
    }
    return primary
  }

  const sql = neon(connectionString)
  const primary = schema ? drizzleNeon(sql, { schema }) : drizzleNeon(sql)

  if (replicas.length === 0) {
    return primary
  }

  const replicaInstances = replicas.map((replicaUrl) => {
    const replicaSql = neon(replicaUrl)
    return schema ? drizzleNeon(replicaSql, { schema }) : drizzleNeon(replicaSql)
  })

  const [firstReplica, ...otherReplicas] = replicaInstances
  if (firstReplica) {
    return withReplicas(primary, [firstReplica, ...otherReplicas])
  }

  return primary
}

/**
 * Get the main database instance.
 * All data is now consolidated in a single EU database.
 */
export function getDb(adapter?: DbAdapter) {
  const url = process.env.DATABASE_URL!
  return createDbClient(url, { adapter })
}

// Lazy default database instance
let _defaultDb: ReturnType<typeof createDbClient> | null = null

function getDefaultDbInstance() {
  if (!_defaultDb) {
    const defaultAdapter = (process.env.DB_ADAPTER as DbAdapter) || "edge"
    _defaultDb = getDb(defaultAdapter)
  }
  return _defaultDb
}

// Export a default, ready-to-use instance with lazy initialization
export const db = new Proxy({} as ReturnType<typeof createDbClient>, {
  get(target, prop) {
    void target
    return getDefaultDbInstance()[prop as keyof ReturnType<typeof createDbClient>]
  },
})

// Re-export lib utilities
export * from "./helpers"
export * from "./lib"
export * from "./lifecycle"
// Re-export queries
export * from "./queries"
export * from "./types"
export * from "./utils"
