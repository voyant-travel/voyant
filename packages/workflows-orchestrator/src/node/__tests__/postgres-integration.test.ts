import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { emptyJournal, type RunRecord } from "../core.js"
import { runPostgresMigrations } from "../migrate.js"
import { createPostgresConnection } from "../postgres.js"
import { createPostgresSnapshotRunStore } from "../postgres-snapshot-run-store.js"
import { createPostgresWakeupStore } from "../postgres-wakeup-store.js"
import type { SnapshotRunStore } from "../snapshot-run-store.js"
import { createWakeupPoller } from "../wakeup-poller.js"
import type { WakeupStore } from "../wakeup-store.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip
const migrationsFolder = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "migrations")

describeIfDb("postgres integration", () => {
  const now = () => 1_700_000_000_000
  let nextRandom = 0.123456

  let connection: ReturnType<typeof createPostgresConnection>
  let snapshots: SnapshotRunStore
  let wakeups: WakeupStore

  beforeAll(async () => {
    connection = createPostgresConnection({ databaseUrl: TEST_DATABASE_URL! })
    await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: migrationsFolder,
    })
    snapshots = createPostgresSnapshotRunStore({
      db: connection.db,
      now,
      random: () => {
        const current = nextRandom
        nextRandom += 0.000001
        return current
      },
    })
    wakeups = createPostgresWakeupStore({
      db: connection.db,
      now,
    })
  })

  beforeEach(async () => {
    nextRandom = 0.123456
    await connection.db.execute(sql`TRUNCATE TABLE voyant_wakeups, voyant_snapshot_runs`)
  })

  afterAll(async () => {
    await connection.close()
  })

  it("persists snapshot runs through the migration-backed schema", async () => {
    const first = await snapshots.save({
      workflowId: "invoice.reminder",
      input: { invoiceId: "inv_1" },
      result: {
        status: "completed",
        startedAt: 1_000,
        completedAt: 1_250,
        tags: ["billing"],
        output: { delivered: true },
      },
      entryFile: "/srv/workflows/bundle.mjs",
    })
    const second = await snapshots.save({
      workflowId: "invoice.reminder",
      input: { invoiceId: "inv_2" },
      result: {
        status: "waiting",
        startedAt: 2_000,
        tags: ["billing", "follow-up"],
      },
      replayOf: first.id,
    })

    expect(await snapshots.get(first.id)).toMatchObject({
      id: first.id,
      workflowId: "invoice.reminder",
      status: "completed",
      durationMs: 250,
      tags: ["billing"],
      entryFile: "/srv/workflows/bundle.mjs",
    })

    const listed = await snapshots.list({ workflowId: "invoice.reminder" })
    expect(listed.map((run) => run.id)).toEqual([second.id, first.id])

    const updated = await snapshots.update?.({
      ...first,
      status: "failed",
      result: {
        ...first.result,
        status: "failed",
        error: "smtp_unreachable",
      },
    })
    expect(updated?.status).toBe("failed")
    expect((await snapshots.get(first.id))?.result).toMatchObject({
      status: "failed",
      error: "smtp_unreachable",
    })

    expect(await snapshots.delete?.(second.id)).toBe(true)
    expect(await snapshots.get(second.id)).toBeUndefined()
  })

  it("leases and releases due wakeups against postgres", async () => {
    await wakeups.upsert({
      runId: "run_due",
      wakeAt: 1_000,
      priority: 1,
    })
    await wakeups.upsert({
      runId: "run_later",
      wakeAt: 10_000,
    })

    const leased = await wakeups.leaseDue({
      owner: "worker-a",
      now: 1_500,
      leaseMs: 5_000,
      limit: 10,
    })
    expect(leased).toHaveLength(1)
    expect(leased[0]).toMatchObject({
      runId: "run_due",
      leaseOwner: "worker-a",
      leaseExpiresAt: 6_500,
    })

    const blocked = await wakeups.leaseDue({
      owner: "worker-b",
      now: 1_600,
      leaseMs: 5_000,
      limit: 10,
    })
    expect(blocked).toEqual([])

    await wakeups.release("run_due", "worker-a")
    expect(await wakeups.get("run_due")).toMatchObject({
      runId: "run_due",
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    })

    const leasedAgain = await wakeups.leaseDue({
      owner: "worker-b",
      now: 1_700,
      leaseMs: 5_000,
      limit: 10,
    })
    expect(leasedAgain).toHaveLength(1)
    expect(leasedAgain[0]?.runId).toBe("run_due")

    const all = await wakeups.list()
    expect(all.map((record) => record.runId)).toEqual(["run_due", "run_later"])
  })

  it("leases higher-priority due wakeups before earlier lower-priority wakeups", async () => {
    await wakeups.upsert({
      runId: "low",
      wakeAt: 1_000,
      priority: 1,
    })
    await wakeups.upsert({
      runId: "high",
      wakeAt: 1_500,
      priority: 10,
    })

    const leased = await wakeups.leaseDue({
      owner: "worker-a",
      now: 2_000,
      leaseMs: 5_000,
      limit: 2,
    })

    expect(leased.map((record) => record.runId)).toEqual(["high", "low"])
  })

  it("lets only one poller instance process a due wakeup lease", async () => {
    const stored = makeStoredRun("run_shared")
    await wakeups.upsert({
      runId: stored.id,
      wakeAt: 1_000,
    })

    const processedBy: string[] = []

    const createPoller = (owner: string) =>
      createWakeupPoller({
        wakeupStore: wakeups,
        getRun: async (runId) => (runId === stored.id ? stored : undefined),
        saveRun: async (next) => next,
        toRecord: (snapshot) => snapshot.runRecord,
        fromRecord: (record, base) => ({
          ...(base ?? { id: record.id, status: record.status }),
          id: record.id,
          status: record.status,
          runRecord: record,
        }),
        handler: async () => ({ status: 200, body: { ok: true } as never }),
        leaseOwner: owner,
        leaseMs: 5_000,
        resumeDueAlarmsImpl: async () => {
          processedBy.push(owner)
          return makeRecord({
            id: stored.id,
            status: "completed",
            pendingWaitpoints: [],
            completedAt: 2_000,
          })
        },
      })

    const workerA = createPoller("worker-a")
    const workerB = createPoller("worker-b")

    await Promise.all([workerA.poll(), workerB.poll()])

    expect(processedBy).toHaveLength(1)
    expect(processedBy[0]).toMatch(/^worker-/)
    expect(await wakeups.get(stored.id)).toBeUndefined()
  })

  it("allows another poller instance to take over after a failed attempt releases its lease", async () => {
    const stored = makeStoredRun("run_failover")
    await wakeups.upsert({
      runId: stored.id,
      wakeAt: 1_000,
    })

    const attempts: string[] = []

    const failingWorker = createWakeupPoller({
      wakeupStore: wakeups,
      getRun: async (runId) => (runId === stored.id ? stored : undefined),
      saveRun: async (next) => next,
      toRecord: (snapshot) => snapshot.runRecord,
      fromRecord: (record, base) => ({
        ...(base ?? { id: record.id, status: record.status }),
        id: record.id,
        status: record.status,
        runRecord: record,
      }),
      handler: async () => ({ status: 200, body: { ok: true } as never }),
      leaseOwner: "worker-a",
      leaseMs: 5_000,
      resumeDueAlarmsImpl: async () => {
        attempts.push("worker-a")
        throw new Error("boom")
      },
    })

    const recoveryWorker = createWakeupPoller({
      wakeupStore: wakeups,
      getRun: async (runId) => (runId === stored.id ? stored : undefined),
      saveRun: async (next) => next,
      toRecord: (snapshot) => snapshot.runRecord,
      fromRecord: (record, base) => ({
        ...(base ?? { id: record.id, status: record.status }),
        id: record.id,
        status: record.status,
        runRecord: record,
      }),
      handler: async () => ({ status: 200, body: { ok: true } as never }),
      leaseOwner: "worker-b",
      leaseMs: 5_000,
      resumeDueAlarmsImpl: async () => {
        attempts.push("worker-b")
        return makeRecord({
          id: stored.id,
          status: "completed",
          pendingWaitpoints: [],
          completedAt: 2_000,
        })
      },
    })

    await failingWorker.poll()
    expect(await wakeups.get(stored.id)).toMatchObject({
      runId: stored.id,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    })

    await recoveryWorker.poll()

    expect(attempts).toEqual(["worker-a", "worker-b"])
    expect(await wakeups.get(stored.id)).toBeUndefined()
  })
})

interface StoredLike {
  id: string
  status: string
  runRecord: RunRecord
}

function makeStoredRun(runId: string): StoredLike {
  return {
    id: runId,
    status: "waiting",
    runRecord: makeRecord({ id: runId }),
  }
}

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run_1",
    workflowId: "wf",
    workflowVersion: "local",
    status: "waiting",
    input: null,
    journal: emptyJournal(),
    invocationCount: 0,
    metadataAppliedCount: 0,
    computeTimeMs: 0,
    pendingWaitpoints: [
      {
        clientWaitpointId: "wp_1",
        kind: "DATETIME",
        meta: { wakeAt: 1_000 },
      },
    ],
    streams: {},
    startedAt: 1,
    triggeredBy: { kind: "manual" },
    tags: [],
    environment: "development",
    tenantMeta: {
      tenantId: "tnt_local",
      projectId: "prj_local",
      organizationId: "org_local",
    },
    runMeta: {
      number: 1,
      attempt: 1,
    },
    ...overrides,
  }
}
