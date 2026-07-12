import {
  createOwnedBookingHandlerRegistry,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import { asPostgresDb } from "./booking-engine-db.js"
import type { BookingEngineEnv } from "./booking-engine-runtime.js"
import { catalogRuntimeExtensions, catalogRuntimeHost } from "./host.js"

export function createOwnedBookingHandlersRegistry(
  env: BookingEngineEnv,
  getSourceRegistry: () => SourceAdapterRegistry,
): OwnedBookingHandlerRegistry {
  const registry = createOwnedBookingHandlerRegistry()
  const { accommodations, cruises, inventory } = catalogRuntimeExtensions()
  const host = {
    getSourceRegistry,
    withDatabase: <T>(operation: (db: ReturnType<typeof asPostgresDb>) => Promise<T>) =>
      catalogRuntimeHost().database.transaction(env, (db) => operation(asPostgresDb(db))),
  }
  inventory.registerOwnedBookingHandler(registry, host)
  accommodations.registerOwnedBookingHandler(registry, host)
  cruises.registerOwnedBookingHandler(registry, host)
  return registry
}
