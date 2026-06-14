import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emptyJournal, type RunRecord } from "@voyant-travel/workflows-orchestrator"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createFsRunRecordStore, filterRunRecords } from "../fs-run-record-store.js"

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "voyant-orch-node-test-"))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeRecord(id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id,
    workflowId: "greet",
    workflowVersion: "local",
    status: "running",
    input: { name: "world" },
    journal: emptyJournal(),
    invocationCount: 0,
    metadataAppliedCount: 0,
    computeTimeMs: 0,
    pendingWaitpoints: [],
    streams: {},
    startedAt: 1_700_000_000_000,
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

describe("createFsRunRecordStore", () => {
  it("saves and retrieves a run record by id", async () => {
    const store = createFsRunRecordStore({ rootDir: tmp })
    const record = makeRecord("run_1", {
      status: "completed",
      output: { message: "hi" },
      completedAt: 1_700_000_000_500,
    })

    await store.save(record)
    const fetched = await store.get("run_1")

    expect(fetched).toEqual(record)
  })

  it("lists run records most-recent-first", async () => {
    const store = createFsRunRecordStore({ rootDir: tmp })
    await store.save(makeRecord("run_1", { startedAt: 10 }))
    await store.save(makeRecord("run_2", { startedAt: 30 }))
    await store.save(makeRecord("run_3", { startedAt: 20 }))

    const listed = await store.list()
    expect(listed.map((run) => run.id)).toEqual(["run_2", "run_3", "run_1"])
  })

  it("filters by workflow id, status, and limit", async () => {
    const store = createFsRunRecordStore({ rootDir: tmp })
    await store.save(
      makeRecord("run_1", { workflowId: "greet", status: "completed", startedAt: 1 }),
    )
    await store.save(makeRecord("run_2", { workflowId: "greet", status: "failed", startedAt: 2 }))
    await store.save(
      makeRecord("run_3", { workflowId: "ledger", status: "completed", startedAt: 3 }),
    )
    await store.save(
      makeRecord("run_4", { workflowId: "greet", status: "completed", startedAt: 4 }),
    )

    expect((await store.list({ workflowId: "greet" })).length).toBe(3)
    expect((await store.list({ status: "completed" })).length).toBe(3)
    expect((await store.list({ workflowId: "greet", status: "completed" })).length).toBe(2)
    expect((await store.list({ limit: 2 })).length).toBe(2)
  })

  it("returns undefined for a missing record id", async () => {
    const store = createFsRunRecordStore({ rootDir: tmp })
    expect(await store.get("run_missing")).toBeUndefined()
  })

  it("handles a missing root dir by returning []", async () => {
    const store = createFsRunRecordStore({ rootDir: join(tmp, "never-created") })
    expect(await store.list()).toEqual([])
  })
})

describe("filterRunRecords", () => {
  it("applies orchestrator-native filters", () => {
    const runs = [
      makeRecord("run_1", { workflowId: "greet", status: "completed", startedAt: 10 }),
      makeRecord("run_2", { workflowId: "greet", status: "failed", startedAt: 20 }),
      makeRecord("run_3", { workflowId: "ledger", status: "completed", startedAt: 30 }),
    ]

    expect(filterRunRecords(runs, { workflowId: "greet" }).map((run) => run.id)).toEqual([
      "run_2",
      "run_1",
    ])
    expect(filterRunRecords(runs, { status: "completed" }).map((run) => run.id)).toEqual([
      "run_3",
      "run_1",
    ])
    expect(filterRunRecords(runs, { limit: 1 }).map((run) => run.id)).toEqual(["run_3"])
  })
})
