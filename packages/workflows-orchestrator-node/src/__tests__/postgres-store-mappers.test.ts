import { describe, expect, it } from "vitest"
import { rowToStoredRun, storedRunToRow } from "../postgres-snapshot-run-store.js"
import { rowToWakeupRecord, wakeupToRow } from "../postgres-wakeup-store.js"

describe("postgres snapshot run mappers", () => {
  it("round-trips nullable snapshot columns", () => {
    const row = storedRunToRow({
      id: "run_1",
      workflowId: "wf",
      status: "waiting",
      startedAt: 100,
      result: { status: "waiting" },
      input: undefined,
      tags: undefined,
      runRecord: undefined,
      entryFile: undefined,
      replayOf: undefined,
    })

    expect(rowToStoredRun(row)).toEqual({
      id: "run_1",
      workflowId: "wf",
      status: "waiting",
      startedAt: 100,
      result: { status: "waiting" },
      input: null,
      tags: [],
    })
  })

  it("preserves an embedded runRecord payload when present", () => {
    const row = storedRunToRow({
      id: "run_2",
      workflowId: "wf",
      status: "waiting",
      startedAt: 100,
      result: { status: "waiting" },
      input: { ok: true },
      runRecord: {
        id: "run_2",
        workflowId: "wf",
        workflowVersion: "local",
        input: { ok: true },
        status: "waiting",
        output: undefined,
        error: undefined,
        startedAt: 100,
        completedAt: undefined,
        attempt: 0,
        tags: [],
        triggeredBy: { kind: "manual" },
        journal: {
          stepResults: {},
          waitpointsResolved: {},
          metadataState: {},
          compKeysReserved: [],
          compensationsRun: {},
        },
        invocationCount: 1,
        streams: {},
      },
    })

    expect(rowToStoredRun(row)).toMatchObject({
      id: "run_2",
      runRecord: {
        id: "run_2",
        workflowId: "wf",
        status: "waiting",
      },
    })
  })
})

describe("postgres wakeup mappers", () => {
  it("round-trips nullable lease columns", () => {
    const row = wakeupToRow(
      {
        runId: "run_1",
        wakeAt: 1000,
        priority: 3,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: 2000,
      },
      2000,
    )

    expect(rowToWakeupRecord(row)).toEqual({
      runId: "run_1",
      wakeAt: 1000,
      priority: 3,
      updatedAt: 2000,
    })
  })
})
