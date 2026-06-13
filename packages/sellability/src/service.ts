import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { constructOffer } from "./service-construct-offer.js"
import * as records from "./service-records.js"
import { resolve } from "./service-resolve.js"
import {
  getSnapshotById,
  listSnapshotItems,
  listSnapshots,
  persistSnapshot,
} from "./service-snapshots.js"
import type {
  SellabilityConstructOfferInput,
  SellabilityPersistSnapshotInput,
} from "./validation.js"

export const sellabilityService = {
  constructOffer(db: PostgresJsDatabase, input: SellabilityConstructOfferInput) {
    return constructOffer(db, input, sellabilityService.resolve)
  },
  persistSnapshot(db: PostgresJsDatabase, input: SellabilityPersistSnapshotInput) {
    return persistSnapshot(db, input, sellabilityService.resolve)
  },
  listSnapshots,
  getSnapshotById,
  listSnapshotItems,
  ...records,
  resolve,
}
