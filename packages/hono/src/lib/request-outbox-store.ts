import type { EventEnvelope, OutboxEventStore } from "@voyant-travel/core"
import { completeOutboxEvent, failOutboxEvent, insertOutboxEvents } from "@voyant-travel/db/outbox"

import {
  type DbFactory,
  resolveDbFactoryResult,
  type VoyantBindings,
  type VoyantDb,
} from "../types.js"

export interface RequestOutboxStoreOptions<TBindings extends VoyantBindings> {
  env: TBindings
  requestDb: () => VoyantDb | undefined
  operationDbFactory: DbFactory<TBindings>
}

/**
 * Outbox store for request-scoped emits.
 *
 * Capture uses the current request DB so the outbox row is written before
 * subscriber delivery starts. Settlement uses a fresh default DB client because
 * scheduled subscribers may finish after the request-owned client has been
 * disposed by middleware cleanup.
 */
export function createRequestOutboxStore<TBindings extends VoyantBindings>(
  options: RequestOutboxStoreOptions<TBindings>,
): OutboxEventStore {
  async function withOperationDb<T>(fn: (db: VoyantDb) => Promise<T>): Promise<T> {
    const { db, dispose } = resolveDbFactoryResult(options.operationDbFactory(options.env))
    try {
      return await fn(db)
    } finally {
      if (dispose) await dispose()
    }
  }

  return {
    async insert(envelope: EventEnvelope) {
      const requestDb = options.requestDb()
      if (!requestDb) {
        throw new Error(
          "[voyant] outbox capture needs the per-request db — emit ran before the db middleware",
        )
      }
      const rows = await insertOutboxEvents(requestDb as never, [envelope])
      const row = rows[0]
      return row ? { id: row.id } : null
    },
    async complete(id) {
      await withOperationDb((db) => completeOutboxEvent(db as never, id))
    },
    async fail(id, error) {
      await withOperationDb((db) => failOutboxEvent(db as never, id, error))
    },
  }
}
