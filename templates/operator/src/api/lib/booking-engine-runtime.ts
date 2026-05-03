/**
 * Process-local SourceAdapterRegistry + adapter wiring for the catalog
 * booking engine.
 *
 * The operator template pre-registers the demo adapter so the lifecycle
 * (`quote` → `book` → `cancel`) is clickable end-to-end out of the box.
 * Other adapters (Voyant Connect peers, GDS, bedbanks) get registered
 * the same way — `registry.register(adapter)` at boot.
 *
 * Held in a module-scope singleton because the registry has process
 * lifetime — adapters carry credentials + HTTP clients + DB handles
 * that shouldn't be re-created per request.
 */

import {
  createSourceAdapterRegistry,
  type SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"
import { createDemoAdapter } from "@voyantjs/catalog-demo-adapter"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { Context } from "hono"

let _registry: SourceAdapterRegistry | undefined

/**
 * Returns the (lazy-initialized) booking-engine registry. The first
 * caller per process creates the registry and registers the bundled
 * adapters; subsequent callers get the same instance.
 *
 * Uses a `getDb` thunk on the demo adapter so the adapter doesn't
 * capture a request-scoped Drizzle client. Each adapter call resolves
 * `getDb()` against whichever DB the caller passes.
 */
export function getBookingEngineRegistry(getDb: () => AnyDrizzleDb): SourceAdapterRegistry {
  if (!_registry) {
    const registry = createSourceAdapterRegistry()
    registry.register(createDemoAdapter({ getDb }))
    _registry = registry
  }
  return _registry
}

/**
 * Convenience helper for route handlers — pulls the registry out of the
 * Hono context's request-scoped DB and returns it. Routes call this
 * inline rather than wiring DI.
 */
export function getBookingEngineRegistryFromContext(c: Context): SourceAdapterRegistry {
  const db = (c.var as { db: AnyDrizzleDb }).db
  return getBookingEngineRegistry(() => db)
}
