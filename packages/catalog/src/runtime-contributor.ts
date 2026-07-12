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
import type { VoyantPort } from "@voyant-travel/core/project"
import { createCatalogRuntime } from "./runtime.js"
import {
  type CatalogRuntimeServices,
  catalogAccommodationsRuntimeExtensionPort,
  catalogChartersRuntimeExtensionPort,
  catalogCommerceRuntimeExtensionPort,
  catalogCruisesRuntimeExtensionPort,
  catalogDemoRuntimeExtensionPort,
  catalogDistributionRuntimeExtensionPort,
  catalogInventoryRuntimeExtensionPort,
  catalogOperationsRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "./runtime-contracts.js"

type RuntimePortValue<T> = T | Promise<T>
const CRUISES_ROUTES_RUNTIME_PORT_ID = "cruises.routes-runtime"

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
  services: RuntimePortValue<CatalogRuntimeServices>
}

export interface CatalogRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

export function createCatalogRuntimePortContribution(
  host: CatalogRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve()
    .then(() =>
      Promise.all([
        host.getRuntimePort(catalogAccommodationsRuntimeExtensionPort),
        host.getRuntimePort(catalogChartersRuntimeExtensionPort),
        host.getRuntimePort(catalogCommerceRuntimeExtensionPort),
        host.getRuntimePort(catalogDistributionRuntimeExtensionPort),
        host.getRuntimePort(catalogCruisesRuntimeExtensionPort),
        host.getRuntimePort(catalogInventoryRuntimeExtensionPort),
        host.getRuntimePort(catalogOperationsRuntimeExtensionPort),
        host.getRuntimePort(catalogDemoRuntimeExtensionPort),
      ]),
    )
    .then(
      ([
        accommodations,
        charters,
        commerce,
        distribution,
        cruises,
        inventory,
        operations,
        catalogDemo,
      ]) =>
        createCatalogRuntime(host.primitives, {
          accommodations,
          charters,
          commerce,
          distribution,
          cruises,
          inventory,
          operations,
          catalogDemo,
        }),
    )
  const cruisesRoutes = {
    resolveSourceAdapterRegistry: async (bindings) => {
      const runtime = await contribution
      return runtime.services.ensureSourceRegistry(host.primitives.env(bindings))
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
