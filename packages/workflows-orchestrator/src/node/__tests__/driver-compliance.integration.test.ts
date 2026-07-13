// Node/Postgres driver compliance — runs the parameterized suite from
// `@voyant-travel/workflows-orchestrator/testing` against `createStandaloneDriver`.
//
// Gated on `TEST_DATABASE_URL`. Mirrors the pattern from
// `postgres-integration.test.ts`: applies migrations once, truncates
// affected tables between tests so suite runs are deterministic.

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe } from "vitest"
import { runDriverComplianceSuite } from "../../testing/driver-compliance.js"

import { runPostgresMigrations } from "../migrate.js"
import { createStandaloneDriver } from "../node-standalone-driver.js"
import { createPostgresConnection } from "../postgres.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip
const migrationsFolder = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "migrations")

describeIfDb("Node/Postgres driver compliance", () => {
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
  //
  // `disableTimeWheel: true` so per-test driver instantiations don't leave
  // rogue pollers running against the shared DB across tests. Sleep-resume
  // (the only suite that needs the wheel) is its own test file with its
  // own truncate + driver lifecycle.
  runDriverComplianceSuite("Node/Postgres", () =>
    createStandaloneDriver({ db: connection.db, disableTimeWheel: true }),
  )
})
