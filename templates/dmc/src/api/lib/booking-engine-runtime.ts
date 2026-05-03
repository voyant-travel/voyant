/**
 * Process-local SourceAdapterRegistry for the dmc template.
 *
 * Mirrors `templates/operator/src/api/lib/booking-engine-runtime.ts` —
 * a tiny lazy-init singleton that lives for the worker's lifetime.
 * Adapters carry HTTP clients and timers; we don't want to re-create
 * them per request.
 *
 * The dmc template currently ships with no upstream adapters — the
 * registry is empty by default. Deployments that want sourced inventory
 * (e.g. a Voyant Connect peer) register their adapter here from env:
 *
 *   if (env.VOYANT_CONNECT_API_URL) {
 *     registry.register(createConnectAdapter({ ... }))
 *   }
 *
 * The registry is exposed on Hono context so the cruise admin routes'
 * /:key flip and the products `/:id/content` endpoint can dispatch
 * through the catalog content service.
 */

import {
  createSourceAdapterRegistry,
  type SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"
import type { Context } from "hono"

let _registry: SourceAdapterRegistry | undefined

export type BookingEngineEnv = {}

export function getBookingEngineRegistry(_env: BookingEngineEnv): SourceAdapterRegistry {
  if (!_registry) {
    _registry = createSourceAdapterRegistry()
    // Register adapters here based on env. Keep this branch thin —
    // adapters live in their own packages.
  }
  return _registry
}

export function getBookingEngineRegistryFromContext(c: Context): SourceAdapterRegistry {
  const env = c.env as BookingEngineEnv
  return getBookingEngineRegistry(env)
}
