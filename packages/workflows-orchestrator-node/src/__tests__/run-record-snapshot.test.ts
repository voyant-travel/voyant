import { emptyJournal, type RunRecord } from "@voyant-travel/workflows-orchestrator"
import { describe, expect, it } from "vitest"
import { recordToSnapshot, snapshotToRecord } from "../run-record-snapshot.js"

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run_1",
    workflowId: "greet",
    workflowVersion: "local",
    status: "completed",
    input: { name: "world" },
    output: { message: "hi" },
    journal: {
      ...emptyJournal(),
      stepResults: {
        fetch: {
          attempt: 1,
          runtime: "edge",
          status: "ok",
          startedAt: 10,
          finishedAt: 25,
          output: { customerId: "cus_1" },
        },
      },
    },
    invocationCount: 1,
    metadataAppliedCount: 0,
    computeTimeMs: 15,
    pendingWaitpoints: [],
    streams: {},
    startedAt: 10,
    completedAt: 25,
    triggeredBy: { kind: "manual" },
    tags: ["billing"],
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

describe("recordToSnapshot", () => {
  it("builds a dashboard-friendly snapshot and preserves base metadata", () => {
    const record = makeRecord()
    const snapshot = recordToSnapshot(record, {
      entryFile: "/tmp/workflows.ts",
      replayOf: "run_prev",
    })

    expect(snapshot.id).toBe("run_1")
    expect(snapshot.workflowId).toBe("greet")
    expect(snapshot.status).toBe("completed")
    expect(snapshot.durationMs).toBe(15)
    expect(snapshot.entryFile).toBe("/tmp/workflows.ts")
    expect(snapshot.replayOf).toBe("run_prev")
    expect(snapshot.result.status).toBe("completed")
    expect(snapshot.result.output).toEqual({ message: "hi" })
    expect(snapshot.result.steps).toEqual([
      {
        id: "fetch",
        status: "ok",
        duration: 15,
        output: { customerId: "cus_1" },
      },
    ])
    expect(snapshot.result.events).toHaveLength(2)
    expect(snapshot.runRecord).toBe(record)
  })
})

describe("snapshotToRecord", () => {
  it("reconstructs the original RunRecord from an embedded snapshot", () => {
    const record = makeRecord()
    const snapshot = recordToSnapshot(record)
    expect(snapshotToRecord(snapshot)).toBe(record)
  })

  it("throws when the embedded runRecord is missing", () => {
    expect(() => snapshotToRecord({ id: "run_missing" })).toThrow(/no embedded runRecord/i)
  })
})
