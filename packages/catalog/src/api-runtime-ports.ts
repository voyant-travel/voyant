import { definePort } from "@voyant-travel/core/project"

import type { CatalogBookingRouteModuleOptions } from "./booking-engine/operator-routes.js"
import type { CatalogOffersRouteModuleOptions } from "./offers/operator-routes.js"
import type { CatalogSearchRoutesOptions } from "./search/routes.js"

export type CatalogSearchRuntimeOptions = Pick<CatalogSearchRoutesOptions, "resolveRuntime">

export const catalogSearchRuntimePort = definePort<CatalogSearchRuntimeOptions>({
  id: "catalog.search-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("catalog.search-runtime provider must be an options object.")
    }
    if (typeof provider.resolveRuntime !== "function") {
      throw new Error("catalog.search-runtime provider must implement resolveRuntime().")
    }
  },
})

export const catalogBookingRuntimePort = definePort<CatalogBookingRouteModuleOptions>({
  id: "catalog.booking-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("catalog.booking-runtime provider must be an options object.")
    }
    if (provider.booking === null || typeof provider.booking !== "object") {
      throw new Error("catalog.booking-runtime provider must configure booking options.")
    }
    for (const method of [
      "resolveRegistry",
      "getProductContent",
      "listAvailabilitySlots",
      "getOwnedProductById",
    ] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`catalog.booking-runtime provider must implement ${method}().`)
      }
    }
  },
})

export const catalogOffersRuntimePort = definePort<CatalogOffersRouteModuleOptions>({
  id: "catalog.offers-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("catalog.offers-runtime provider must be an options object.")
    }
    for (const method of [
      "resolveConnectClient",
      "fetchIndexFields",
      "resolveDynamicHotelIds",
      "resolveAirportLabels",
    ] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`catalog.offers-runtime provider must implement ${method}().`)
      }
    }
  },
})
