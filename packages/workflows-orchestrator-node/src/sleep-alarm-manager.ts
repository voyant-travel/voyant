import {
  createInMemoryRunStore,
  type RunRecord,
  resumeDueAlarms,
  type StepHandler,
  type StreamChunk,
} from "@voyantjs/workflows-orchestrator"

export interface SleepAlarmStoredRun {
  id: string
  status: string
}

export interface SleepAlarmManagerDeps<TStored extends SleepAlarmStoredRun> {
  listRuns: () => Promise<TStored[]>
  getRun: (runId: string) => Promise<TStored | undefined>
  saveRun: (stored: TStored) => Promise<TStored>
  toRecord: (stored: TStored) => RunRecord
  fromRecord: (record: RunRecord, base?: TStored) => TStored
  handler: StepHandler
  onStreamChunk?: (event: { runId: string; chunk: StreamChunk }) => void
  now?: () => number
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
  logger?: (level: "warn" | "error", message: string, data?: object) => void
  createRunStore?: typeof createInMemoryRunStore
  resumeDueAlarmsImpl?: typeof resumeDueAlarms
}

export interface SleepAlarmManager<TStored extends SleepAlarmStoredRun> {
  schedule: (stored: TStored) => void
  clear: (runId: string) => void
  bootstrap: () => Promise<void>
  stop: () => void
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

export function createSleepAlarmManager<TStored extends SleepAlarmStoredRun>(
  deps: SleepAlarmManagerDeps<TStored>,
): SleepAlarmManager<TStored> {
  const now = deps.now ?? (() => Date.now())
  const setTimeoutImpl = deps.setTimeout ?? setTimeout
  const clearTimeoutImpl = deps.clearTimeout ?? clearTimeout
  const log = deps.logger ?? (() => {})
  const makeRunStore = deps.createRunStore ?? createInMemoryRunStore
  const resumeDueAlarmsFn = deps.resumeDueAlarmsImpl ?? resumeDueAlarms

  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const clear = (runId: string): void => {
    const timer = timers.get(runId)
    if (timer) {
      clearTimeoutImpl(timer)
      timers.delete(runId)
    }
  }

  const fire = async (runId: string): Promise<void> => {
    timers.delete(runId)
    const existing = await deps.getRun(runId)
    if (!existing || existing.status !== "waiting") return

    const record = deps.toRecord(existing)
    const store = makeRunStore()
    await store.save(record)
    const resumed = await resumeDueAlarmsFn(
      { runId },
      {
        store,
        handler: deps.handler,
        onStreamChunk: deps.onStreamChunk
          ? (chunk) => deps.onStreamChunk?.({ runId, chunk })
          : undefined,
      },
    )
    if (!resumed) return

    const saved = await deps.saveRun(deps.fromRecord(resumed, existing))
    schedule(saved)
  }

  const schedule = (stored: TStored): void => {
    clear(stored.id)
    if (stored.status !== "waiting") return

    let record: RunRecord
    try {
      record = deps.toRecord(stored)
    } catch (err) {
      log("warn", `sleep-alarm: failed to read run snapshot for "${stored.id}"`, {
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }

    const earliest = findEarliestWakeAt(record)
    if (earliest === undefined) return
    const delay = Math.max(0, earliest - now())
    const timer = setTimeoutImpl(() => {
      void fire(stored.id).catch((err) => {
        log("error", `sleep-alarm: failed to resume "${stored.id}"`, {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }, delay)
    unrefTimer(timer)
    timers.set(stored.id, timer)
  }

  return {
    schedule,
    clear,
    async bootstrap() {
      const runs = await deps.listRuns()
      for (const run of runs) {
        if (run.status === "waiting") schedule(run)
      }
    },
    stop() {
      for (const runId of [...timers.keys()]) clear(runId)
    },
  }
}

export function findEarliestWakeAt(record: RunRecord): number | undefined {
  let earliest: number | undefined
  for (const waitpoint of record.pendingWaitpoints) {
    if (waitpoint.kind !== "DATETIME") continue
    const wakeAt = typeof waitpoint.meta.wakeAt === "number" ? waitpoint.meta.wakeAt : undefined
    if (wakeAt === undefined) continue
    earliest = earliest === undefined ? wakeAt : Math.min(earliest, wakeAt)
  }
  return earliest
}
