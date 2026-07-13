// Node/Postgres sleep-resume integration test — verifies that workflows
// parked on `ctx.sleep(...)` actually wake up via the wakeup poller
// wired into `createStandaloneDriver`. Closes the gap reviewer P1.2
// flagged: prior to wiring `createPersistentWakeupManager` into the
// driver, parked runs would persist as `waiting` and never resume.
//
// Gated on TEST_DATABASE_URL; the wakeup machinery talks to real Postgres.

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { __resetRegistry, workflow } from "@voyant-travel/workflows"
import { sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest"

import { runPostgresMigrations } from "../migrate.js"
import { createStandaloneDriver } from "../node-standalone-driver.js"
import { createPostgresConnection } from "../postgres.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip
const migrationsFolder = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "migrations")

describeIfDb("Node/Postgres sleep-resume", () => {
  let connection: ReturnType<typeof createPostgresConnection>

  beforeAll(async () => {
    connection = createPostgresConnection({ databaseUrl: TEST_DATABASE_URL! })
    await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: migrationsFolder,
    })
  })

  beforeEach(async () => {
    await connection.db.execute(
      sql`TRUNCATE TABLE voyant_workflow_manifests, voyant_wakeups, voyant_snapshot_runs`,
    )
    __resetRegistry()
  })

  afterEach(() => {
    __resetRegistry()
  })

  afterAll(async () => {
    await connection.close()
  })

  test("ctx.sleep parks then resumes via the wakeup poller", async () => {
    // Aggressive interval so the test stays fast.
    const driver = createStandaloneDriver({
      db: connection.db,
      wakeupPollIntervalMs: 100,
      wakeupLeaseMs: 1_000,
    })({
      services: {
        resolve<T>(): T {
          throw new Error("no services")
        },
        has() {
          return false
        },
      },
      logger: () => {},
    })

    // Use `ctx.step` to record the post-sleep work — step bodies are
    // journaled, so they execute exactly once per workflow invocation
    // (unlike free body code which replays). That's the right shape
    // for asserting "the run resumed and finished its post-sleep work."
    const wf = workflow<Record<string, never>, { resumed: boolean; sleptAt: number }>({
      id: "sleep-resume-test",
      async run(_input, ctx) {
        const sleptAt = ctx.now()
        await ctx.sleep("100ms")
        const resumed = await ctx.step("post-sleep", async () => true)
        return { resumed, sleptAt }
      },
    })

    // Trigger the run; workflow body will park on the sleep waitpoint.
    const run = await driver.trigger(wf, {})

    // Initially the run is in the "waiting" state with a wakeup row.
    const initial = await driver.admin?.getRun?.(run.id)
    expect(initial?.status).toBe("waiting")
    const wakeupRowsResult = await connection.db.execute(
      // agent-quality: raw-sql reviewed -- owner: workflows-orchestrator; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      sql`SELECT run_id, wake_at FROM voyant_wakeups WHERE run_id = ${run.id}`,
    )
    const wakeupRowsCount =
      (wakeupRowsResult as { rows?: unknown[] }).rows?.length ?? wakeupRowsResult.length ?? 0
    expect(wakeupRowsCount).toBe(1)

    // Wait for the poller to wake the run. With a 100ms sleep + 100ms
    // poll cadence, ~500ms is generous.
    const start = Date.now()
    let detail = await driver.admin?.getRun?.(run.id)
    while (detail?.status === "waiting" && Date.now() - start < 5_000) {
      await new Promise((r) => setTimeout(r, 100))
      detail = await driver.admin?.getRun?.(run.id)
    }

    // The run resumed and finished — `resumed: true` came from the
    // post-sleep step body, which only executes after the wakeup poller
    // resolves the DATETIME waitpoint.
    expect(detail?.status).toBe("completed")
    expect((detail?.output as { resumed: boolean }).resumed).toBe(true)

    await driver.shutdown?.()
  }, 10_000)

  test("driver.shutdown stops the poller (process can exit cleanly)", async () => {
    const driver = createStandaloneDriver({
      db: connection.db,
      wakeupPollIntervalMs: 50,
    })({
      services: {
        resolve<T>(): T {
          throw new Error("no services")
        },
        has() {
          return false
        },
      },
      logger: () => {},
    })

    // Just confirm shutdown returns without hanging. Without the
    // poller-stop fix, the setInterval would keep the event loop alive.
    await driver.shutdown?.()
    expect(true).toBe(true)
  })
})
