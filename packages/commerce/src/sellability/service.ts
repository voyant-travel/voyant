import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import * as records from "./service-records.js"
import { resolve } from "./service-resolve.js"
import {
  getSnapshotById,
  listSnapshotItems,
  listSnapshots,
  persistSnapshot,
} from "./service-snapshots.js"
import type { SellabilityPersistSnapshotInput } from "./validation.js"

export type SellabilityServiceOptions = Record<string, never>

export function createSellabilityService(_options: SellabilityServiceOptions = {}) {
  const service = {
    persistSnapshot(db: PostgresJsDatabase, input: SellabilityPersistSnapshotInput) {
      return persistSnapshot(db, input, service.resolve)
    },
    listSnapshots,
    getSnapshotById,
    listSnapshotItems,
    ...records,
    resolve,
  }

  return service
}

export const sellabilityService = createSellabilityService()
