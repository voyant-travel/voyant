/**
 * Build the `SourceAdapterRegistry` used by the source discovery sync CLI
 * (`scripts/sync-sources.ts`). Extracted so tests can assert the registry wiring
 * — Connect + cruise adapters — without executing the CLI's DB/Typesense
 * side effects.
 *
 * Uses the SAME `registerCruiseAdapters` seam as the live booking-engine registry
 * (`src/api/lib/booking-engine-runtime.ts`), so sync covers the identical set of
 * cruise providers the admin/public/content/booking paths see.
 */

import {
  createSourceAdapterRegistry,
  type SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import {
  prepareVoyantConnectSources,
  registerVoyantConnectSources,
} from "@voyant-travel/plugin-voyant-connect"

import {
  CRUISE_ADAPTER_READ_CACHE_TTL_MS,
  registerCruiseAdapters,
} from "../../src/api/lib/cruise-adapters-runtime.js"

export async function buildSyncSourceRegistry(
  env: NodeJS.ProcessEnv,
): Promise<SourceAdapterRegistry> {
  const registry = createSourceAdapterRegistry()

  // Voyant Connect: enumerate the operator's active connections and register one
  // generic + structured-cruise (+ TUI package) adapter set per connection, keyed
  // by connection id. Env resolution is shared with the live booking-engine
  // registry via `prepareVoyantConnectSources` so the two paths can't drift.
  registerVoyantConnectSources(
    registry,
    await prepareVoyantConnectSources(env, {
      enumerate: true,
      // Memoize cruise reads for the duration of the run (no KV in the CLI, so no
      // cross-isolate connection cache here).
      cruise: { memoize: { ttlMs: CRUISE_ADAPTER_READ_CACHE_TTL_MS } },
      warn: (message) => console.warn(`[sync-sources] ${message}`),
    }),
  )

  // Deployment-owned cruise connectors → both planes, plus back-fill the vertical
  // registry from the Connect cruise shims registered just above.
  registerCruiseAdapters(registry, env)

  return registry
}
