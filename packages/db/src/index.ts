import { neon, Pool, type PoolConfig } from "@neondatabase/serverless"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import type { NeonDatabase as NeonWsDatabase } from "drizzle-orm/neon-serverless"
import { drizzle as drizzleNeonServerless } from "drizzle-orm/neon-serverless"
import { withReplicas } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { VOYANT_DB_DISPOSE, VOYANT_DB_SUPPORTS_TRANSACTIONS } from "./transaction-capability.js"

export type DbAdapter = "edge" | "node" | "serverless"

export interface DisposableDbClient<TDb = AnyDrizzleDb> {
  db: TDb
  dispose: () => Promise<void>
}

export interface DbClientOptions<TSchema extends Record<string, unknown> = Record<string, never>> {
  schema?: TSchema
  adapter?: DbAdapter
  replicas?: string[]
  nodeMaxConnections?: number
  serverlessPool?: Omit<PoolConfig, "connectionString">
}

function tagTransactionCapability<TDb extends object>(
  db: TDb,
  supportsTransactions: boolean,
  dispose?: () => Promise<void>,
): TDb {
  Object.defineProperty(db, VOYANT_DB_SUPPORTS_TRANSACTIONS, {
    value: supportsTransactions,
    enumerable: false,
    configurable: false,
  })
  if (dispose) {
    Object.defineProperty(db, VOYANT_DB_DISPOSE, {
      value: dispose,
      enumerable: false,
      configurable: false,
    })
  }
  return db
}

/**
 * Union of the drizzle driver flavors a Voyant deployment can wire up:
 * `PostgresJsDatabase` (node adapter / direct TCP), `NeonHttpDatabase`
 * (edge adapter / Neon HTTP), and `NeonWsDatabase` (edge adapter / Neon
 * serverless WebSocket — the only Workers-compatible flavor that
 * supports real Postgres transactions). Use this as the parameter type
 * for `resolveDb`-style callbacks in module factories so consumers
 * don't need `as unknown as ...` casts when wiring different drivers.
 */
export type AnyDrizzleDb<TSchema extends Record<string, unknown> = Record<string, never>> =
  | PostgresJsDatabase<TSchema>
  | NeonHttpDatabase<TSchema>
  | NeonWsDatabase<TSchema>

export function createDbClient<TSchema extends Record<string, unknown> = Record<string, never>>(
  connectionString: string,
  options?: DbClientOptions<TSchema>,
) {
  const {
    adapter = (process.env.DB_ADAPTER as DbAdapter) || "edge",
    schema,
    replicas = [],
    nodeMaxConnections,
  } = options || {}

  if (adapter === "node") {
    const client = postgres(connectionString, nodeMaxConnections ? { max: nodeMaxConnections } : {})
    const primary = tagTransactionCapability(
      schema ? drizzlePostgres(client, { schema }) : drizzlePostgres(client),
      true,
    )

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
      return tagTransactionCapability(withReplicas(primary, [firstReplica, ...otherReplicas]), true)
    }
    return primary
  }

  if (adapter === "serverless") {
    if (replicas.length > 0) {
      throw new Error("DB_ADAPTER=serverless does not support read replicas")
    }
    return createServerlessDbClient(connectionString, {
      schema,
      pool: options?.serverlessPool,
    }).db
  }

  const sql = neon(connectionString)
  const primary = tagTransactionCapability(
    schema ? drizzleNeon(sql, { schema }) : drizzleNeon(sql),
    false,
  )

  if (replicas.length === 0) {
    return primary
  }

  const replicaInstances = replicas.map((replicaUrl) => {
    const replicaSql = neon(replicaUrl)
    return schema ? drizzleNeon(replicaSql, { schema }) : drizzleNeon(replicaSql)
  })

  const [firstReplica, ...otherReplicas] = replicaInstances
  if (firstReplica) {
    return tagTransactionCapability(withReplicas(primary, [firstReplica, ...otherReplicas]), false)
  }

  return primary
}

export function createServerlessDbClient<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  connectionString: string,
  options?: {
    schema?: TSchema
    pool?: Omit<PoolConfig, "connectionString">
  },
): DisposableDbClient<NeonWsDatabase<TSchema>> {
  const pool = new Pool({ ...options?.pool, connectionString })
  const dispose = () => pool.end().catch(() => {})
  const db = tagTransactionCapability(
    options?.schema
      ? drizzleNeonServerless(pool, { schema: options.schema })
      : drizzleNeonServerless(pool),
    true,
    dispose,
  ) as NeonWsDatabase<TSchema>

  return {
    db,
    dispose,
  }
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
    if (defaultAdapter === "serverless") {
      throw new Error(
        "The global @voyantjs/db proxy cannot use DB_ADAPTER=serverless. Use createServerlessDbClient() per request and dispose it after use.",
      )
    }
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
export * from "./helpers.js"
export * from "./lib/index.js"
export * from "./lifecycle.js"
// Re-export queries
export * from "./queries/index.js"
export * from "./transaction-capability.js"
export * from "./types.js"
export * from "./utils.js"
