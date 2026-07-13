import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { __resetRegistry, workflow } from "@voyant-travel/workflows"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { type ServeHandle, startSelfHostServer } from "../dashboard-server.js"
import { runPostgresMigrations } from "../migrate.js"
import { createPostgresConnection } from "../postgres.js"
import { createPostgresSnapshotRunStore } from "../postgres-snapshot-run-store.js"
import { createPostgresWakeupStore } from "../postgres-wakeup-store.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip
const migrationsFolder = fileURLToPath(new URL("../../../migrations", import.meta.url))

describeIfDb("node self-host server over postgres", () => {
  let tempDir: string
  let entryFile: string
  let server: ServeHandle
  let connection: ReturnType<typeof createPostgresConnection>
  let baseUrl: string

  beforeAll(async () => {
    __resetRegistry()
    workflow({
      id: "stale_registry_entry",
      async run() {
        return { ok: false }
      },
    })
    tempDir = await mkdtemp(join(tmpdir(), "voyant-selfhost-server-"))
    entryFile = join(tempDir, "bundle.mjs")
    await writeFile(
      entryFile,
      [
        'import { workflow } from "@voyant-travel/workflows";',
        "",
        "workflow({",
        '  id: "server_wait_signal",',
        '  description: "Waits for an approval signal over HTTP.",',
        "  async run(input, ctx) {",
        '    const decision = await ctx.waitForSignal("approve");',
        "    return { input, approved: decision?.approved === true };",
        "  },",
        "});",
        "",
        "workflow({",
        '  id: "server_sleep",',
        '  description: "Parks on ctx.sleep so the wakeup store is exercised.",',
        "  async run(_input, ctx) {",
        '    await ctx.sleep("1h");',
        '    return { status: "done" };',
        "  },",
        "});",
        "",
        "workflow({",
        '  id: "server_short_sleep",',
        '  description: "Short sleep that should auto-resume via the wakeup poller.",',
        "  async run(_input, ctx) {",
        '    await ctx.sleep("50ms");',
        '    return { status: "woke" };',
        "  },",
        "});",
        "",
      ].join("\n"),
      "utf8",
    )

    connection = createPostgresConnection({ databaseUrl: TEST_DATABASE_URL! })
    await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: migrationsFolder,
    })

    const port = await getFreePort()
    server = await startSelfHostServer({
      entryFile,
      host: "127.0.0.1",
      port,
      databaseUrl: TEST_DATABASE_URL!,
      wakeupPollIntervalMs: 250,
      wakeupLeaseMs: 5_000,
      cacheBustEntry: true,
    })
    baseUrl = server.url
  })

  beforeEach(async () => {
    await connection.db.execute(sql`TRUNCATE TABLE voyant_wakeups, voyant_snapshot_runs`)
  })

  afterAll(async () => {
    await server?.close()
    await connection?.close()
    await rm(tempDir, { recursive: true, force: true })
    __resetRegistry()
  })

  it("serves workflow listing, trigger, resume, and wakeup persistence over HTTP", async () => {
    const health = await requestJson<{ ok: boolean; service: string }>(`${baseUrl}/healthz`)
    expect(health).toMatchObject({
      ok: true,
      service: "voyant-workflows-selfhost",
    })

    const ready = await requestJson<{
      ok: boolean
      checks: Record<string, string>
    }>(`${baseUrl}/readyz`)
    expect(ready).toMatchObject({
      ok: true,
      checks: {
        workflowEntry: "ok",
        database: "ok",
      },
    })

    const metrics = await requestText(`${baseUrl}/metrics`)
    expect(metrics).toContain("voyant_selfhost_up 1")
    expect(metrics).toContain("voyant_selfhost_workflows_registered 3")
    expect(metrics).toContain("voyant_selfhost_runs_total 0")
    expect(metrics).toContain("voyant_selfhost_wakeups_total 0")

    const workflows = await requestJson<{ workflows: Array<{ id: string }> }>(
      `${baseUrl}/api/workflows`,
    )
    expect(workflows.workflows.map((workflow) => workflow.id)).toEqual(
      expect.arrayContaining(["server_wait_signal", "server_sleep", "server_short_sleep"]),
    )
    expect(workflows.workflows.map((workflow) => workflow.id)).not.toContain("stale_registry_entry")

    const waitTriggered = await requestJson<{
      saved: { id: string; status: string; workflowId: string }
    }>(`${baseUrl}/api/runs`, {
      method: "POST",
      body: JSON.stringify({
        workflowId: "server_wait_signal",
        input: { requestId: "req_1" },
      }),
    })
    expect(waitTriggered.saved).toMatchObject({
      workflowId: "server_wait_signal",
      status: "waiting",
    })

    const snapshotStore = createPostgresSnapshotRunStore({ db: connection.db })
    expect(await snapshotStore.get(waitTriggered.saved.id)).toMatchObject({
      id: waitTriggered.saved.id,
      status: "waiting",
      workflowId: "server_wait_signal",
    })

    const resumed = await requestJson<{
      saved: { id: string; status: string; result: { approved: boolean } }
    }>(`${baseUrl}/api/runs/${waitTriggered.saved.id}/signals`, {
      method: "POST",
      body: JSON.stringify({
        name: "approve",
        payload: { approved: true },
      }),
    })
    expect(resumed.saved).toMatchObject({
      id: waitTriggered.saved.id,
      status: "completed",
      result: {
        output: {
          approved: true,
        },
      },
    })

    const sleepTriggered = await requestJson<{
      saved: { id: string; status: string; workflowId: string }
    }>(`${baseUrl}/api/runs`, {
      method: "POST",
      body: JSON.stringify({
        workflowId: "server_sleep",
        input: null,
      }),
    })
    expect(sleepTriggered.saved).toMatchObject({
      workflowId: "server_sleep",
      status: "waiting",
    })

    const wakeupStore = createPostgresWakeupStore({ db: connection.db })
    expect(await wakeupStore.get(sleepTriggered.saved.id)).toMatchObject({
      runId: sleepTriggered.saved.id,
    })

    const listedRuns = await requestJson<{
      runs: Array<{ id: string; workflowId: string; status: string }>
    }>(`${baseUrl}/api/runs`)
    expect(listedRuns.runs.map((run) => run.id)).toEqual(
      expect.arrayContaining([waitTriggered.saved.id, sleepTriggered.saved.id]),
    )

    const metricsAfter = await requestText(`${baseUrl}/metrics`)
    expect(metricsAfter).toContain("voyant_selfhost_runs_total 2")
    expect(metricsAfter).toContain('voyant_selfhost_runs_status{status="completed"} 1')
    expect(metricsAfter).toContain('voyant_selfhost_runs_status{status="waiting"} 1')
    expect(metricsAfter).toContain("voyant_selfhost_wakeups_total 1")
  })

  it("auto-resumes due sleep wakeups through the postgres-backed poller", async () => {
    const triggered = await requestJson<{
      saved: { id: string; status: string; workflowId: string }
    }>(`${baseUrl}/api/runs`, {
      method: "POST",
      body: JSON.stringify({
        workflowId: "server_short_sleep",
        input: null,
      }),
    })

    expect(triggered.saved).toMatchObject({
      workflowId: "server_short_sleep",
      status: "waiting",
    })

    const wakeupStore = createPostgresWakeupStore({ db: connection.db })
    expect(await wakeupStore.get(triggered.saved.id)).toMatchObject({
      runId: triggered.saved.id,
    })

    const completed = await waitFor(
      async () =>
        requestJson<{
          run: {
            id: string
            status: string
            result: { output?: { status?: string } }
          }
        }>(`${baseUrl}/api/runs/${triggered.saved.id}`),
      (payload) => payload.run.status === "completed",
      { timeoutMs: 4_000, intervalMs: 50 },
    )

    expect(completed.run).toMatchObject({
      id: triggered.saved.id,
      status: "completed",
      result: {
        output: {
          status: "woke",
        },
      },
    })
    expect(await wakeupStore.get(triggered.saved.id)).toBeUndefined()
  })
})

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
  }
  return JSON.parse(text) as T
}

async function requestText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
  }
  return text
}

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate test port")))
        return
      }
      const { port } = address
      server.close((err) => {
        if (err) reject(err)
        else resolve(port)
      })
    })
  })
}

async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  opts: { timeoutMs: number; intervalMs: number },
): Promise<T> {
  const startedAt = Date.now()
  let lastValue: T | undefined
  while (Date.now() - startedAt < opts.timeoutMs) {
    lastValue = await fn()
    if (predicate(lastValue)) return lastValue
    await new Promise((resolve) => setTimeout(resolve, opts.intervalMs))
  }
  throw new Error(
    `timed out waiting for predicate after ${opts.timeoutMs}ms: ${JSON.stringify(lastValue)}`,
  )
}
