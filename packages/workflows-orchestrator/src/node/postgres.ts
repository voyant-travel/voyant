import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { snapshotRunsTable, wakeupsTable } from "./postgres-schema.js"

export interface PostgresConnection {
  pool: Pool
  db: ReturnType<typeof drizzle>
  close: () => Promise<void>
}

export interface CreatePostgresConnectionOptions {
  databaseUrl: string
}

export function createPostgresConnection(
  opts: CreatePostgresConnectionOptions,
): PostgresConnection {
  const pool = new Pool({
    connectionString: opts.databaseUrl,
  })
  const db = drizzle(pool, {
    schema: {
      snapshotRunsTable,
      wakeupsTable,
    },
  })

  return {
    pool,
    db,
    close: async () => {
      await pool.end()
    },
  }
}
