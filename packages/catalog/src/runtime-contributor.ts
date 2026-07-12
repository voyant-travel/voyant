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

/** Package-owned registration map for Catalog's deployment-supplied runtime adapters. */
export function createCatalogRuntimePortContribution(
  contribution: CatalogRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [catalogSearchRuntimePort.id]: contribution.search,
    [catalogBookingRuntimePort.id]: contribution.booking,
    [catalogOffersRuntimePort.id]: contribution.offers,
    [catalogContentRuntimePort.id]: contribution.content,
    [catalogProjectionRuntimePort.id]: contribution.projection,
    [catalogBookingSnapshotRuntimePort.id]: contribution.bookingSnapshot,
  }
}
