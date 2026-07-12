import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CatalogSearchRuntimeOptions } from "./api-runtime-ports.js"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
import type { CatalogBookingRouteModuleOptions } from "./booking-engine/operator-routes.js"
import { type CatalogContentRuntime, catalogContentRuntimePort } from "./content-runtime-port.js"
import type { CatalogOffersRouteModuleOptions } from "./offers/operator-routes.js"
import {
  type CatalogBookingSnapshotRuntimeProvider,
  type CatalogProjectionRuntimeProvider,
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "./subscriber-runtime-ports.js"

type RuntimePortValue<T> = T | Promise<T>

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
}

export interface CatalogRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Catalog defaults lowered from the generic runtime host. */
export function createCatalogRuntimePortContribution(
  host: CatalogRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = import("./standard-node-runtime.js").then((module) =>
    module.createCatalogStandardNodeRuntime(host.primitives),
  )
  return {
    [catalogSearchRuntimePort.id]: contribution.then((runtime) => runtime.search),
    [catalogBookingRuntimePort.id]: contribution.then((runtime) => runtime.booking),
    [catalogOffersRuntimePort.id]: contribution.then((runtime) => runtime.offers),
    [catalogContentRuntimePort.id]: contribution.then((runtime) => runtime.content),
    [catalogProjectionRuntimePort.id]: contribution.then((runtime) => runtime.projection),
    [catalogBookingSnapshotRuntimePort.id]: contribution.then((runtime) => runtime.bookingSnapshot),
  }
}
