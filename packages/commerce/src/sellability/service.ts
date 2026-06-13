import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { constructOffer, type SellabilityOfferWriter } from "./service-construct-offer.js"
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

export interface SellabilityServiceOptions {
  offerWriter?: SellabilityOfferWriter
}

export function createSellabilityService(options: SellabilityServiceOptions = {}) {
  const service = {
    constructOffer(db: PostgresJsDatabase, input: SellabilityConstructOfferInput) {
      return constructOffer(db, input, service.resolve, options.offerWriter)
    },
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
