/**
 * Database test helpers. Wraps `@voyant-travel/db/test-utils` with
 * availability probing and vitest describe helpers.
 */

import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe } from "vitest"

export { cleanupTestDb, createTestDb }

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

/**
 * Resolved test database URL. Falls back to the docker-compose.test.yml default
 * when `TEST_DATABASE_URL` is not set.
 */
export const TEST_DATABASE_URL = runtimeEnv.TEST_DATABASE_URL ?? buildDefaultTestDbUrl(TEST_DB_PORT)

/**
 * `true` when the `TEST_DATABASE_URL` env var is set. Cheap synchronous check —
 * does NOT verify the server is reachable.
 *
 * Use this for `describe.skipIf(!DB_AVAILABLE)` in simple cases.
 */
export const DB_ENV_SET = !!runtimeEnv.TEST_DATABASE_URL

/**
 * Attempts a `SELECT 1` against the test database to confirm connectivity.
 * Returns `true` if the env var is set AND the probe succeeds.
 *
 * Use this at the top of integration test files that must short-circuit
 * when the DB is unreachable (prevents vitest from hanging on dead connections).
 */
export async function probeTestDb(): Promise<boolean> {
  if (!DB_ENV_SET) return false
  try {
    const db = createTestDb()
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

/**
 * Wraps `describe.skipIf(!DB_ENV_SET)`. Use for integration tests that only
 * need to check the env var is present.
 *
 * @example
 * describeIfDb("Account routes", () => { ... })
 */
export const describeIfDb: typeof describe = describe.skipIf(!DB_ENV_SET) as typeof describe

/**
 * Builds a `describe.skipIf(...)` bound to the probe result. Use when you
 * want to skip not just on env-var absence but also on unreachable DB.
 *
 * @example
 * const DB_OK = await probeTestDb()
 * const describeIf = buildDescribeIf(DB_OK)
 * describeIf("crud service", () => { ... })
 */
export function buildDescribeIf(available: boolean): typeof describe {
  return describe.skipIf(!available) as typeof describe
}

/**
 * Truncates all public-schema tables in the test database. Thin alias for
 * `cleanupTestDb` from `@voyant-travel/db/test-utils`, re-exported here so
 * callers can depend on a single package.
 */
export async function resetTestDb(db: PostgresJsDatabase): Promise<void> {
  await cleanupTestDb(db)
}
