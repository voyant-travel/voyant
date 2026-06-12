import type { SnapshotRunStore, StoredRun } from "./snapshot-run-store.js"

export type StoreEvent =
  | { kind: "snapshot"; runs: readonly StoredRun[] }
  | { kind: "added"; run: StoredRun }
  | { kind: "updated"; run: StoredRun }
  | { kind: "removed"; runId: string }

export type StoreListener = (event: StoreEvent) => void

export interface StoreStream {
  subscribe: (listener: StoreListener) => () => void
  poll: () => Promise<void>
  stop: () => void
  subscriberCount: () => number
}

export interface StoreStreamOptions {
  intervalMs?: number
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
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

export function diffSnapshots(
  prev: readonly StoredRun[],
  next: readonly StoredRun[],
): StoreEvent[] {
  const prevById = new Map(prev.map((run) => [run.id, run]))
  const nextById = new Map(next.map((run) => [run.id, run]))
  const events: StoreEvent[] = []

  for (const run of next) {
    const prevRun = prevById.get(run.id)
    if (!prevRun) {
      events.push({ kind: "added", run })
      continue
    }
    if (prevRun.status !== run.status || prevRun.durationMs !== run.durationMs) {
      events.push({ kind: "updated", run })
    }
  }

  for (const run of prev) {
    if (!nextById.has(run.id)) {
      events.push({ kind: "removed", runId: run.id })
    }
  }

  return events
}

export function createStoreStream(
  store: SnapshotRunStore,
  opts: StoreStreamOptions = {},
): StoreStream {
  const intervalMs = opts.intervalMs ?? 1000
  const setIntervalImpl = opts.setInterval ?? setInterval
  const clearIntervalImpl = opts.clearInterval ?? clearInterval

  const listeners = new Set<StoreListener>()
  let current: StoredRun[] = []
  let polling = false
  let initialised = false

  async function pollOnce(): Promise<void> {
    if (polling) return
    polling = true
    try {
      const next = await store.list()
      if (!initialised) {
        current = next
        initialised = true
        return
      }
      const events = diffSnapshots(current, next)
      current = next
      if (events.length === 0) return
      for (const event of events) {
        for (const listener of listeners) listener(event)
      }
    } catch {
      // Polling must not crash the host server.
    } finally {
      polling = false
    }
  }

  const handle = setIntervalImpl(() => {
    void pollOnce()
  }, intervalMs)
  unrefTimer(handle)

  return {
    subscribe(listener) {
      const dispatchSnapshot = async (): Promise<void> => {
        if (!initialised) {
          current = await store.list()
          initialised = true
        }
        listener({ kind: "snapshot", runs: current })
      }
      void dispatchSnapshot()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    poll: pollOnce,
    stop() {
      clearIntervalImpl(handle)
      listeners.clear()
    },
    subscriberCount() {
      return listeners.size
    },
  }
}
