import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { EventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type CruiseRoutesEnv = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
    /** Catalog source-adapter registry used by external cruise content routes. */
    sourceAdapterRegistry?: SourceAdapterRegistry
  }
}
