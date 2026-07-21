import type { DeliveryResult, EventEnvelope } from "@voyant-travel/core"
import { definePort, type VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"

import { drainOutbox, getOutboxStats, pruneDeliveredOutboxEvents } from "./outbox.js"
import type { DrizzleClient } from "./types.js"
import { expireStaleWriteIntents } from "./write-intents.js"

/** The only host capabilities admitted to the database-owned outbox job. */
export interface EventOutboxJobRuntime {
  withDb<T>(operation: (db: DrizzleClient) => Promise<T>): Promise<T>
  deliver(envelope: EventEnvelope): Promise<DeliveryResult>
  warn(message: string): void
}

export const eventOutboxJobRuntimePort = definePort<EventOutboxJobRuntime>({
  id: "infrastructure.event-outbox-delivery",
  test(runtime) {
    for (const method of ["withDb", "deliver", "warn"] as const) {
      if (!runtime || typeof runtime[method] !== "function") {
        throw new Error(`infrastructure.event-outbox-delivery provider must implement ${method}().`)
      }
    }
  },
})

/** Drain durable outbox/write-intent state without accepting invocation input. */
export async function runEventOutboxDrainJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(eventOutboxJobRuntimePort)
  await runtime.withDb(async (db) => {
    const result = await drainOutbox(
      db,
      { deliver: (envelope) => runtime.deliver(envelope) },
      { limit: 50, visibilityTimeoutMs: 120_000 },
    )
    await pruneDeliveredOutboxEvents(db, { olderThanDays: 14 })
    const expiredIntents = await expireStaleWriteIntents(db, { olderThanMinutes: 30 })
    if (expiredIntents > 0) {
      runtime.warn(`[outbox-drain] expired ${expiredIntents} stale write intent(s)`)
    }
    const stats = await getOutboxStats(db)
    if (stats.failed > 0) {
      runtime.warn(`[outbox-drain] ${stats.failed} dead-lettered event(s) need attention`)
    }
    if (result.deadLettered > 0) {
      runtime.warn(`[outbox-drain] ${result.deadLettered} event(s) exhausted delivery attempts`)
    }
  })
}
