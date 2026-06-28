import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { createDbClient } from "./index.js"

type RuntimeEnv = Record<string, string | undefined>

const runtimeEnv = (globalThis as { process?: { env?: RuntimeEnv } }).process?.env ?? {}

const TEST_DB_PORT = runtimeEnv.TEST_DATABASE_PORT ?? "5436"
const TEST_DB_NAME = "voyant_test"
const TEST_DB_USER = "test"
const TEST_DB_PASSWORD = "test"

function buildDefaultTestDbUrl(port: string) {
  const url = new URL("postgres://localhost")
  url.port = port
  url.pathname = `/${TEST_DB_NAME}`
  url.username = TEST_DB_USER
  url.password = TEST_DB_PASSWORD
  return url.toString()
}

const TEST_DB_URL = runtimeEnv.TEST_DATABASE_URL ?? buildDefaultTestDbUrl(TEST_DB_PORT)

type PostgresJsDatabaseWithClient = PostgresJsDatabase & {
  $client?: {
    end?: (options?: { timeout?: number | null }) => Promise<unknown>
  }
}

let testDbSingleton: PostgresJsDatabaseWithClient | null = null

/**
 * Creates a database client connected to the test database.
 * Requires the test Postgres instance from `docker-compose.test.yml`.
 *
 * Always uses the Node.js adapter (postgres.js) since tests run in Node.
 */
export function createTestDb(): PostgresJsDatabase {
  if (!testDbSingleton) {
    testDbSingleton = createDbClient(TEST_DB_URL, {
      adapter: "node",
      nodeMaxConnections: 1,
      // Production timeout defaults don't apply to test infrastructure:
      // cleanupTestDb's TRUNCATE over the full ~350-table schema can
      // exceed the 10s statement_timeout on a cold Postgres, killing
      // every integration suite's setup.
      timeouts: { statementMs: false, queryMs: false, connectMs: false },
    }) as PostgresJsDatabaseWithClient
  }

  return testDbSingleton
}

/**
 * Closes the shared test database client for the current process.
 */
export async function closeTestDb(): Promise<void> {
  const db = testDbSingleton
  testDbSingleton = null

  await db?.$client?.end?.({ timeout: 0 })
}

/**
 * Truncates all non-system tables in the test database.
 */
export async function cleanupTestDb(db: PostgresJsDatabase): Promise<void> {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )

  const tables = result as { tablename: string }[]
  if (tables.length > 0) {
    const names = tables.map((r) => `"${r.tablename}"`).join(", ")
    await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
  }
}
