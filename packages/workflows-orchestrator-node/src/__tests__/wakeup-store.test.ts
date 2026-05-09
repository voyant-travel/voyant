import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emptyJournal, type RunRecord } from "@voyantjs/workflows-orchestrator"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createFsWakeupStore, syncWakeupFromRecord } from "../wakeup-store.js"

let tmp: string
let clock = 1_700_000_000_000

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "voyant-wakeup-test-"))
  clock = 1_700_000_000_000
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

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
        meta: { wakeAt: clock + 5_000 },
      },
    ],
    streams: {},
    startedAt: clock,
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

describe("createFsWakeupStore", () => {
  it("upserts and retrieves wakeups", async () => {
    const store = createFsWakeupStore({ rootDir: tmp, now: () => clock })
    await store.upsert({ runId: "run_1", wakeAt: clock + 1000 })
    expect(await store.get("run_1")).toEqual({
      runId: "run_1",
      wakeAt: clock + 1000,
      updatedAt: clock,
    })
  })

  it("leases only due and expired wakeups", async () => {
    const store = createFsWakeupStore({ rootDir: tmp, now: () => clock })
    await store.upsert({ runId: "due", wakeAt: clock - 1 })
    await store.upsert({ runId: "future", wakeAt: clock + 10_000 })
    await store.upsert({
      runId: "leased",
      wakeAt: clock - 1,
      leaseOwner: "other",
      leaseExpiresAt: clock + 5_000,
    })

    const leased = await store.leaseDue({
      owner: "worker_a",
      now: clock,
      leaseMs: 2_000,
    })
    expect(leased.map((w) => w.runId)).toEqual(["due"])

    clock += 10_000
    const expired = await store.leaseDue({
      owner: "worker_b",
      now: clock,
      leaseMs: 2_000,
    })
    expect(expired.map((w) => w.runId).sort()).toEqual(["due", "future", "leased"])
  })

  it("leases higher-priority due wakeups before earlier lower-priority wakeups", async () => {
    const store = createFsWakeupStore({ rootDir: tmp, now: () => clock })
    await store.upsert({ runId: "low", wakeAt: clock - 10_000, priority: 1 })
    await store.upsert({ runId: "high", wakeAt: clock - 1, priority: 10 })

    const leased = await store.leaseDue({
      owner: "worker_a",
      now: clock,
      leaseMs: 2_000,
      limit: 2,
    })
    expect(leased.map((w) => w.runId)).toEqual(["high", "low"])
  })
})

describe("syncWakeupFromRecord", () => {
  it("creates and removes wakeups based on run state", async () => {
    const store = createFsWakeupStore({ rootDir: tmp, now: () => clock })
    await syncWakeupFromRecord(store, makeRecord())
    expect((await store.list()).map((w) => w.runId)).toEqual(["run_1"])

    await syncWakeupFromRecord(store, makeRecord({ priority: 5 }))
    expect(await store.get("run_1")).toMatchObject({ priority: 5 })

    await syncWakeupFromRecord(store, makeRecord({ status: "completed", pendingWaitpoints: [] }))
    expect(await store.list()).toEqual([])
  })
})
