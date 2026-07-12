import type { CatalogCruisesRuntimeExtension } from "@voyant-travel/catalog/runtime-contracts"
import {
  type CruiseAdapter,
  type CruiseSourceAdapterShim,
  cruiseAdapterToSourceAdapter,
} from "./adapters/index.js"
import { memoizeCruiseAdapter } from "./adapters/memoize.js"
import { hasCruiseAdapter, registerCruiseAdapter } from "./adapters/registry.js"
import { registerCruiseBookingHandler } from "./booking-engine/operator-runtime.js"
import { cruiseCabinFacetsCatalogPolicy } from "./catalog-policy-cabins.js"
import { createCruiseDocumentBuilder, createCruisesRegistry } from "./service-catalog-plane.js"
import { createCruiseCabinFacetProjectionExtension } from "./service-catalog-plane-cabins.js"

export const CRUISE_ADAPTER_READ_CACHE_TTL_MS = 60_000

export function withReadCache(adapter: CruiseAdapter): CruiseAdapter {
  return memoizeCruiseAdapter(adapter, { ttlMs: CRUISE_ADAPTER_READ_CACHE_TTL_MS })
}

function syncRegistry(registry: Parameters<CatalogCruisesRuntimeExtension["syncRegistry"]>[0]) {
  for (const kind of registry.kinds()) {
    if (!kind.startsWith("cruise:")) continue
    for (const { adapter } of registry.byKind(kind)) {
      const cruiseAdapter = asCruiseShim(adapter)?.cruiseAdapter
      if (cruiseAdapter && !hasCruiseAdapter(cruiseAdapter.name)) {
        registerCruiseAdapter(cruiseAdapter)
      }
    }
  }
}

function asCruiseShim(adapter: unknown): CruiseSourceAdapterShim | undefined {
  return adapter && typeof adapter === "object" && "cruiseAdapter" in adapter
    ? (adapter as CruiseSourceAdapterShim)
    : undefined
}

export const catalogCruisesRuntimeExtension = {
  fieldPolicy: cruiseCabinFacetsCatalogPolicy,
  createRegistry: (fieldPolicy) => createCruisesRegistry(fieldPolicy),
  createDocumentBuilder: ({ db, sellerOperatorId, registry, extensions }) =>
    createCruiseDocumentBuilder(db, { sellerOperatorId, registry, extensions }),
  createCabinFacetProjectionExtension: () => createCruiseCabinFacetProjectionExtension(),
  registerOwnedBookingHandler: registerCruiseBookingHandler,
  registerAdapters(registry, _env, adapters = []) {
    for (const rawAdapter of adapters) {
      const adapter = rawAdapter as CruiseAdapter
      if (!hasCruiseAdapter(adapter.name)) registerCruiseAdapter(adapter)
      if (!registry.hasKind(`cruise:${adapter.name}`)) {
        registry.register(cruiseAdapterToSourceAdapter(adapter))
      }
    }
    syncRegistry(registry)
  },
  syncRegistry,
} satisfies CatalogCruisesRuntimeExtension

export const registerCruiseAdapters = catalogCruisesRuntimeExtension.registerAdapters
export const syncVerticalRegistryFromCatalog = catalogCruisesRuntimeExtension.syncRegistry

export function resetConfiguredCruiseAdapters(): void {
  // The neutral extension has no deployment-owned adapter list.
}
