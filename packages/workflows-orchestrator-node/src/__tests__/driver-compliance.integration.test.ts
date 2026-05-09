// Mode 2 driver compliance — runs the parameterized suite from
// `@voyantjs/workflows-orchestrator/testing` against `createNodeStandaloneDriver`.
//
// Gated on `TEST_DATABASE_URL`. Mirrors the pattern from
// `postgres-integration.test.ts`: applies migrations once, truncates
// affected tables between tests so suite runs are deterministic.

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runDriverComplianceSuite } from "@voyantjs/workflows-orchestrator/testing"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe } from "vitest"

import { runPostgresMigrations } from "../migrate.js"
import { createNodeStandaloneDriver } from "../node-standalone-driver.js"
import { createPostgresConnection } from "../postgres.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip
const migrationsFolder = resolve(fileURLToPath(new URL("../../", import.meta.url)), "drizzle")

describeIfDb("Mode 2 (Postgres) driver compliance", () => {
  let connection: ReturnType<typeof createPostgresConnection>

  beforeAll(async () => {
    connection = createPostgresConnection({ databaseUrl: TEST_DATABASE_URL! })
    await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: migrationsFolder,
    })
  })

  beforeEach(async () => {
    // Compliance tests register manifests + create runs; truncate every
    // affected table between tests so each test starts fresh.
    await connection.db.execute(
      sql`TRUNCATE TABLE voyant_workflow_manifests, voyant_wakeups, voyant_snapshot_runs`,
    )
  })

  afterAll(async () => {
    await connection.close()
  })

  // The suite assumes a single driver factory it can instantiate per test.
  // Each call to the factory returns a fresh driver wired against the same
  // shared Postgres connection — exactly the production shape.
  runDriverComplianceSuite("Mode 2 (Postgres)", () =>
    createNodeStandaloneDriver({ db: connection.db }),
  )
})
