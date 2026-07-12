import { registerAccommodationBookingHandler } from "@voyant-travel/accommodations/booking-engine/operator-runtime"
import {
  createOwnedBookingHandlerRegistry,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import { registerCruiseBookingHandler } from "@voyant-travel/cruises/booking-engine/operator-runtime"
import { registerProductBookingHandler } from "@voyant-travel/inventory/booking-engine/operator-runtime"

import { asPostgresDb } from "./booking-engine-db"
import type { BookingEngineEnv } from "./booking-engine-runtime"
import { withDbFromEnv } from "./db"

export function createOwnedBookingHandlersRegistry(
  env: BookingEngineEnv,
  getSourceRegistry: () => SourceAdapterRegistry,
): OwnedBookingHandlerRegistry {
  const registry = createOwnedBookingHandlerRegistry()
  const host = {
    getSourceRegistry,
    withDatabase: <T>(operation: (db: ReturnType<typeof asPostgresDb>) => Promise<T>) =>
      withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], (db) =>
        operation(asPostgresDb(db)),
      ),
  }
  registerProductBookingHandler(registry, host)
  registerAccommodationBookingHandler(registry, host)
  registerCruiseBookingHandler(registry, host)
  return registry
}
