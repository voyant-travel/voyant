import { describe, expect, it, vi } from "vitest"
import { emptyJournal, type RunRecord } from "../core.js"
import { createWakeupPoller } from "../wakeup-poller.js"
import type { WakeupStore } from "../wakeup-store.js"

interface StoredLike {
  id: string
  status: string
  runRecord: RunRecord
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

function makeWakeupStore(): WakeupStore {
  return {
    get: vi.fn(),
    upsert: vi.fn(async (record) => ({
      ...record,
      updatedAt: record.updatedAt ?? 1_000,
    })),
    delete: vi.fn(async () => true),
    list: vi.fn(async () => []),
    leaseDue: vi.fn(async () => [{ runId: "run_1", wakeAt: 1_000, updatedAt: 1_000 }]),
    release: vi.fn(async () => {}),
  }
}

describe("createWakeupPoller", () => {
  it("leases due wakeups, resumes, saves, and syncs the next wakeup", async () => {
    const wakeupStore = makeWakeupStore()
    const stored: StoredLike = {
      id: "run_1",
      status: "waiting",
      runRecord: makeRecord(),
    }
    const resumed = makeRecord({
      status: "completed",
      pendingWaitpoints: [],
      completedAt: 2_000,
    })
    const saveRun = vi.fn(async (next: StoredLike) => next)
    const resumeDueAlarmsImpl = vi.fn(async () => resumed)

    const poller = createWakeupPoller<StoredLike>({
      wakeupStore,
      getRun: async () => stored,
      saveRun,
      toRecord: (snapshot) => snapshot.runRecord,
      fromRecord: (record, base) => ({
        ...(base ?? { id: record.id, status: record.status }),
        id: record.id,
        status: record.status,
        runRecord: record,
      }),
      handler: vi.fn(async () => {
        return { status: 200, body: { ok: true } as never }
      }),
      leaseOwner: "worker_a",
      resumeDueAlarmsImpl,
    })

    await poller.poll()

    expect(wakeupStore.leaseDue).toHaveBeenCalledTimes(1)
    expect(resumeDueAlarmsImpl).toHaveBeenCalledTimes(1)
    expect(saveRun).toHaveBeenCalledWith({
      id: "run_1",
      status: "completed",
      runRecord: resumed,
    })
    expect(wakeupStore.delete).toHaveBeenCalledWith("run_1")
  })
})
