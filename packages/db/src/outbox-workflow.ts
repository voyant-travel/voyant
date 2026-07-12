import type { EventBus } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import { drainOutbox, getOutboxStats, pruneDeliveredOutboxEvents } from "./outbox.js"
import type { DrizzleClient } from "./types.js"
import { expireStaleWriteIntents } from "./write-intents.js"

export const EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY = "infrastructure.event-outbox-runtime"

export interface EventOutboxWorkflowRuntime {
  withDb<T>(operation: (db: DrizzleClient) => Promise<T>): Promise<T>
  resolveEventBus(): Promise<EventBus>
  warn(message: string): void
}

export const eventOutboxDrainWorkflow = workflow({
  id: "infrastructure.event-outbox-drain",
  async run(_input, ctx) {
    const runtime = ctx.services.resolve<EventOutboxWorkflowRuntime>(
      EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY,
    )
    const eventBus = await runtime.resolveEventBus()
    return runtime.withDb(async (db) => {
      const result = await drainOutbox(db, eventBus, {
        limit: 50,
        visibilityTimeoutMs: 120_000,
      })
      await pruneDeliveredOutboxEvents(db, { olderThanDays: 14 })
      const expiredIntents = await expireStaleWriteIntents(db, { olderThanMinutes: 30 })
      if (expiredIntents > 0) {
        runtime.warn(`[outbox-drain] expired ${expiredIntents} stale write intent(s)`)
      }
      const stats = await getOutboxStats(db)
      if (stats.failed > 0) {
        runtime.warn(`[outbox-drain] ${stats.failed} dead-lettered event(s) need attention`)
      }
      return { ...result, pendingAfter: stats.pending, deadLettered: stats.failed }
    })
  },
})
