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
import { catalogRuntimeServicesPort } from "./runtime-contracts.js"

type RuntimePortValue<T> = T | Promise<T>
const CRUISES_ROUTES_RUNTIME_PORT_ID = "cruises.routes-runtime"

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
  services: RuntimePortValue<import("./runtime-contracts.js").CatalogRuntimeServices>
}

export interface CatalogRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

export function createCatalogRuntimePortContribution(
  host: CatalogRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = import("./runtime.js").then((module) =>
    module.createCatalogRuntime(host.primitives),
  )
  const cruisesRoutes = {
    resolveSourceAdapterRegistry: async (bindings) => {
      await contribution
      const runtime = await import("./runtime/booking-engine-runtime.js")
      return runtime.ensureBookingEngineRegistry(host.primitives.env(bindings))
    },
  }
  return {
    [catalogSearchRuntimePort.id]: contribution.then((runtime) => runtime.search),
    [catalogBookingRuntimePort.id]: contribution.then((runtime) => runtime.booking),
    [catalogOffersRuntimePort.id]: contribution.then((runtime) => runtime.offers),
    [catalogContentRuntimePort.id]: contribution.then((runtime) => runtime.content),
    [catalogProjectionRuntimePort.id]: contribution.then((runtime) => runtime.projection),
    [catalogBookingSnapshotRuntimePort.id]: contribution.then((runtime) => runtime.bookingSnapshot),
    [catalogRuntimeServicesPort.id]: contribution.then((runtime) => runtime.services),
    [CRUISES_ROUTES_RUNTIME_PORT_ID]: cruisesRoutes,
  }
}
