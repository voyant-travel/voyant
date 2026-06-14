import {
  createInMemoryRunStore,
  type RunRecord,
  resumeDueAlarms,
  type StepHandler,
  type StreamChunk,
} from "@voyant-travel/workflows-orchestrator"
import type { WakeupStore } from "./wakeup-store.js"
import { syncWakeupFromRecord } from "./wakeup-store.js"

export interface WakeupPollerStoredRun {
  id: string
  status: string
}

export interface WakeupPollerDeps<TStored extends WakeupPollerStoredRun> {
  wakeupStore: WakeupStore
  getRun: (runId: string) => Promise<TStored | undefined>
  saveRun: (stored: TStored) => Promise<TStored>
  toRecord: (stored: TStored) => RunRecord
  fromRecord: (record: RunRecord, base?: TStored) => TStored
  handler: StepHandler
  leaseOwner: string
  leaseMs?: number
  intervalMs?: number
  now?: () => number
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
  onStreamChunk?: (event: { runId: string; chunk: StreamChunk }) => void
  logger?: (level: "warn" | "error", message: string, data?: object) => void
  createRunStore?: typeof createInMemoryRunStore
  resumeDueAlarmsImpl?: typeof resumeDueAlarms
}

export interface WakeupPoller<TStored extends WakeupPollerStoredRun> {
  start: () => void
  stop: () => void
  poll: () => Promise<void>
  syncStoredRun: (stored: TStored) => Promise<void>
}

function unrefTimer(timer: unknown): void {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref()
  }
}

export function createWakeupPoller<TStored extends WakeupPollerStoredRun>(
  deps: WakeupPollerDeps<TStored>,
): WakeupPoller<TStored> {
  const intervalMs = deps.intervalMs ?? 1_000
  const leaseMs = deps.leaseMs ?? Math.max(intervalMs * 4, 5_000)
  const now = deps.now ?? (() => Date.now())
  const setIntervalImpl = deps.setInterval ?? setInterval
  const clearIntervalImpl = deps.clearInterval ?? clearInterval
  const log = deps.logger ?? (() => {})
  const makeRunStore = deps.createRunStore ?? createInMemoryRunStore
  const resumeDueAlarmsImpl = deps.resumeDueAlarmsImpl ?? resumeDueAlarms

  let timer: ReturnType<typeof setInterval> | undefined
  let polling = false

  const poll = async (): Promise<void> => {
    if (polling) return
    polling = true
    try {
      const leased = await deps.wakeupStore.leaseDue({
        owner: deps.leaseOwner,
        now: now(),
        leaseMs,
      })
      for (const wakeup of leased) {
        await processWakeup(wakeup.runId)
      }
    } finally {
      polling = false
    }
  }

  const processWakeup = async (runId: string): Promise<void> => {
    const stored = await deps.getRun(runId)
    if (!stored) {
      await deps.wakeupStore.delete(runId)
      return
    }
    if (stored.status !== "waiting") {
      await deps.wakeupStore.delete(runId)
      return
    }

    try {
      const record = deps.toRecord(stored)
      const store = makeRunStore()
      await store.save(record)
      const resumed = await resumeDueAlarmsImpl(
        { runId },
        {
          store,
          handler: deps.handler,
          onStreamChunk: deps.onStreamChunk
            ? (chunk) => deps.onStreamChunk?.({ runId, chunk })
            : undefined,
        },
      )
      if (!resumed) {
        await syncWakeupFromRecord(deps.wakeupStore, record)
        return
      }
      const saved = await deps.saveRun(deps.fromRecord(resumed, stored))
      await syncWakeupFromRecord(deps.wakeupStore, deps.toRecord(saved))
    } catch (err) {
      await deps.wakeupStore.release(runId, deps.leaseOwner)
      log("error", `wakeup-poller: failed to process "${runId}"`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    start() {
      if (timer) return
      timer = setIntervalImpl(() => {
        void poll().catch(() => {})
      }, intervalMs)
      unrefTimer(timer)
    },
    stop() {
      if (!timer) return
      clearIntervalImpl(timer)
      timer = undefined
    },
    poll,
    async syncStoredRun(stored) {
      await syncWakeupFromRecord(deps.wakeupStore, deps.toRecord(stored))
    },
  }
}
