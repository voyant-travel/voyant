import type { CatalogSearchRuntimeOptions } from "@voyant-travel/catalog/api-runtime-ports"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "@voyant-travel/catalog/api-runtime-ports"
import type { CatalogBookingRouteModuleOptions } from "@voyant-travel/catalog/booking-engine/operator-routes"
import type { CatalogOffersRouteModuleOptions } from "@voyant-travel/catalog/offers"
import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import {
  type CatalogBookingSnapshotRuntimeProvider,
  type CatalogProjectionRuntimeProvider,
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "@voyant-travel/catalog/subscriber-runtime-ports"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  type CruisesRoutesRuntime,
  cruisesRoutesRuntimePort,
} from "@voyant-travel/cruises/runtime-port"

type RuntimePortValue<T> = T | Promise<T>

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
}

export interface CatalogNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

export function createCatalogNodeRuntimePortContribution(
  host: CatalogNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = import("./standard-node-runtime.js").then((module) =>
    module.createCatalogStandardNodeRuntime(host.primitives),
  )
  const cruisesRoutes: CruisesRoutesRuntime = {
    resolveSourceAdapterRegistry: (bindings) =>
      import("./standard-node/booking-engine-runtime.js").then((runtime) =>
        runtime.ensureBookingEngineRegistry(host.primitives.env(bindings)),
      ),
  }
  return {
    [catalogSearchRuntimePort.id]: contribution.then((runtime) => runtime.search),
    [catalogBookingRuntimePort.id]: contribution.then((runtime) => runtime.booking),
    [catalogOffersRuntimePort.id]: contribution.then((runtime) => runtime.offers),
    [catalogContentRuntimePort.id]: contribution.then((runtime) => runtime.content),
    [catalogProjectionRuntimePort.id]: contribution.then((runtime) => runtime.projection),
    [catalogBookingSnapshotRuntimePort.id]: contribution.then((runtime) => runtime.bookingSnapshot),
    [cruisesRoutesRuntimePort.id]: cruisesRoutes,
  }
}
