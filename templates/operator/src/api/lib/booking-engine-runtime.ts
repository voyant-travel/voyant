/**
 * Process-local SourceAdapterRegistry + adapter wiring for the catalog
 * booking engine.
 *
 * Adapters live in their own packages (see `@voyantjs/plugin-catalog-demo`)
 * and are registered conditionally based on the deployment's environment.
 * The operator template ships zero demo state — no tables, no seed; if
 * `CATALOG_DEMO_API_URL` isn't set, the demo adapter simply doesn't
 * register and `demo` rows fail with `NoAdapterRegisteredError` (a
 * reviewer-friendly 503).
 *
 * Real upstream adapters (Voyant Connect peers, GDS, bedbanks) follow
 * the same posture — register conditionally based on their own env vars.
 *
 * Held in a module-scope singleton because the registry has process
 * lifetime — adapters carry HTTP clients and timers that shouldn't be
 * re-created per request.
 */

import {
  createSourceAdapterRegistry,
  type SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import type { Context } from "hono"

let _registry: SourceAdapterRegistry | undefined

/**
 * Returns the (lazy-initialized) booking-engine registry. The first
 * caller per process creates the registry and conditionally registers
 * each adapter; subsequent callers get the same instance.
 *
 * Adapter registration is gated on env vars so deployments without an
 * upstream simply don't pre-load that branch.
 */
export function getBookingEngineRegistry(env: BookingEngineEnv): SourceAdapterRegistry {
  if (!_registry) {
    const registry = createSourceAdapterRegistry()
    if (env.CATALOG_DEMO_API_URL) {
      registry.register(createDemoCatalogAdapter({ baseUrl: env.CATALOG_DEMO_API_URL }))
    }
    _registry = registry
  }
  return _registry
}

export interface BookingEngineEnv {
  CATALOG_DEMO_API_URL?: string
}

/**
 * Convenience helper for route handlers — pulls env from the Hono
 * context and returns the (cached) registry.
 */
export function getBookingEngineRegistryFromContext(c: Context): SourceAdapterRegistry {
  const env = c.env as BookingEngineEnv
  return getBookingEngineRegistry(env)
}
