import type { SourceAdapterRegistry } from "@voyantjs/catalog/booking-engine"
import type { EventBus } from "@voyantjs/core"
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
