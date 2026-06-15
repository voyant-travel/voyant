import { describe, expect, it, vi } from "vitest"
import { emptyJournal, type RunRecord } from "../core.js"
import { createPersistentWakeupManager } from "../persistent-wakeup-manager.js"
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
    leaseDue: vi.fn(async () => []),
    release: vi.fn(async () => {}),
  }
}

describe("createPersistentWakeupManager", () => {
  it("bootstraps waiting runs into the wakeup store and clears runs", async () => {
    const wakeupStore = makeWakeupStore()
    const waiting: StoredLike = {
      id: "run_waiting",
      status: "waiting",
      runRecord: makeRecord({ id: "run_waiting" }),
    }
    const completed: StoredLike = {
      id: "run_completed",
      status: "completed",
      runRecord: makeRecord({
        id: "run_completed",
        status: "completed",
        pendingWaitpoints: [],
      }),
    }

    const manager = createPersistentWakeupManager<StoredLike>({
      wakeupStore,
      listRuns: async () => [waiting, completed],
      getRun: async () => waiting,
      saveRun: vi.fn(async (stored) => stored),
      toRecord: (stored) => stored.runRecord,
      fromRecord: (record, base) => ({
        ...(base ?? { id: record.id, status: record.status }),
        id: record.id,
        status: record.status,
        runRecord: record,
      }),
      handler: vi.fn(async () => ({ status: 200, body: { ok: true } as never })),
      leaseOwner: "worker_a",
    })

    await manager.bootstrap()

    expect(wakeupStore.upsert).toHaveBeenCalledWith({
      runId: "run_waiting",
      wakeAt: 1_000,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    })
    expect(wakeupStore.delete).toHaveBeenCalledWith("run_completed")

    await manager.clear("run_waiting")
    expect(wakeupStore.delete).toHaveBeenCalledWith("run_waiting")
  })
})
