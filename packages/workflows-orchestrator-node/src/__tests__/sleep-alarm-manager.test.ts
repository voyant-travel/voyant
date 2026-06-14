import { emptyJournal, type RunRecord } from "@voyant-travel/workflows-orchestrator"
import { describe, expect, it, vi } from "vitest"
import { createSleepAlarmManager, findEarliestWakeAt } from "../sleep-alarm-manager.js"

interface StoredLike {
  id: string
  status: string
  runRecord?: RunRecord
}

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run_1",
    workflowId: "sleepy",
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
    startedAt: 10,
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

describe("findEarliestWakeAt", () => {
  it("returns the earliest DATETIME waitpoint wakeAt", () => {
    const record = makeRecord({
      pendingWaitpoints: [
        { clientWaitpointId: "a", kind: "EVENT", meta: {} },
        { clientWaitpointId: "b", kind: "DATETIME", meta: { wakeAt: 5_000 } },
        { clientWaitpointId: "c", kind: "DATETIME", meta: { wakeAt: 1_500 } },
      ],
    })
    expect(findEarliestWakeAt(record)).toBe(1_500)
  })
})

describe("createSleepAlarmManager", () => {
  it("resumes due alarms and persists the resumed snapshot", async () => {
    const resumedRecord = makeRecord({
      status: "completed",
      pendingWaitpoints: [],
      completedAt: 2_000,
    })
    const stored: StoredLike = {
      id: "run_1",
      status: "waiting",
      runRecord: makeRecord(),
    }
    let scheduledCallback: (() => void) | undefined
    let resolveSaved: (() => void) | undefined
    const savedCalled = new Promise<void>((resolve) => {
      resolveSaved = resolve
    })
    const saveRun = vi.fn(async (next: StoredLike) => {
      resolveSaved?.()
      return next
    })
    const resumeDueAlarmsImpl = vi.fn(async () => resumedRecord)

    const manager = createSleepAlarmManager<StoredLike>({
      listRuns: async () => [stored],
      getRun: async () => stored,
      saveRun,
      toRecord: (snapshot) => snapshot.runRecord!,
      fromRecord: (record, base) => ({
        ...(base ?? { id: record.id, status: record.status }),
        id: record.id,
        status: record.status,
        runRecord: record,
      }),
      handler: vi.fn(async () => ({
        status: 200,
        body: { ok: true } as never,
      })),
      now: () => 1_500,
      setTimeout: ((fn: () => void) => {
        scheduledCallback = fn
        return { unref() {} } as ReturnType<typeof setTimeout>
      }) as typeof setTimeout,
      clearTimeout: vi.fn() as typeof clearTimeout,
      resumeDueAlarmsImpl,
    })

    await manager.bootstrap()
    expect(scheduledCallback).toBeTypeOf("function")

    scheduledCallback?.()
    await savedCalled

    expect(resumeDueAlarmsImpl).toHaveBeenCalledTimes(1)
    expect(saveRun).toHaveBeenCalledWith({
      id: "run_1",
      status: "completed",
      runRecord: resumedRecord,
    })
  })
})
