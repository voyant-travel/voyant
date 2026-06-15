import {
  createWakeupPoller,
  type WakeupPoller,
  type WakeupPollerDeps,
  type WakeupPollerStoredRun,
} from "./wakeup-poller.js"
import type { WakeupStore } from "./wakeup-store.js"

export interface PersistentWakeupManager<TStored extends WakeupPollerStoredRun> {
  bootstrap: () => Promise<void>
  start: () => void
  stop: () => void
  syncStoredRun: (stored: TStored) => Promise<void>
  clear: (runId: string) => Promise<void>
  poll: () => Promise<void>
}

export interface PersistentWakeupManagerDeps<TStored extends WakeupPollerStoredRun>
  extends WakeupPollerDeps<TStored> {
  listRuns: () => Promise<TStored[]>
  wakeupStore: WakeupStore
}

export function createPersistentWakeupManager<TStored extends WakeupPollerStoredRun>(
  deps: PersistentWakeupManagerDeps<TStored>,
): PersistentWakeupManager<TStored> {
  const poller: WakeupPoller<TStored> = createWakeupPoller(deps)

  return {
    async bootstrap() {
      const runs = await deps.listRuns()
      for (const run of runs) {
        await poller.syncStoredRun(run)
      }
    },
    start() {
      poller.start()
    },
    stop() {
      poller.stop()
    },
    syncStoredRun(stored) {
      return poller.syncStoredRun(stored)
    },
    clear(runId) {
      return deps.wakeupStore.delete(runId).then(() => undefined)
    },
    poll() {
      return poller.poll()
    },
  }
}
