import {
  type CatalogRuntimeServices,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import {
  type CatalogCheckoutApiRuntime,
  catalogCheckoutApiRuntimePort,
} from "@voyant-travel/commerce/checkout"
import { commerceCardPaymentRuntimePort } from "@voyant-travel/commerce/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import { type FlightsRuntime, flightsRuntimePort } from "@voyant-travel/flights"
import { storefrontPaymentLinkRuntimePort } from "@voyant-travel/storefront"
import type { TripsRoutesOptionsProvider } from "./routes.js"
import { createTripsRoutesRuntime } from "./runtime.js"
import {
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "./runtime-port.js"
import {
  createCommerceCardPaymentRuntime,
  createStandardPaymentLinkRouteOptions,
} from "./storefront-payment-link-runtime.js"

type RuntimePortValue<T> = T | Promise<T>

export interface TripsRuntimePortContribution {
  tripsRoutes: RuntimePortValue<TripsRoutesOptionsProvider>
  tripsDatabase: RuntimePortValue<TripsDatabaseRuntime>
}

export interface TripsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Package-owned registration map for Trips deployment adapters. */
export function createTripsRuntimePortContribution(
  host: TripsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const cardPayment = createCommerceCardPaymentRuntime()
  const tripsRoutes = Promise.resolve()
    .then(() =>
      Promise.all([
        host.getRuntimePort<CatalogRuntimeServices>(catalogRuntimeServicesPort),
        host.getRuntimePort<CatalogCheckoutApiRuntime>(catalogCheckoutApiRuntimePort),
        host.getRuntimePort<FlightsRuntime>(flightsRuntimePort),
      ]),
    )
    .then(([catalog, checkout, flights]) =>
      createTripsRoutesRuntime(host.primitives, { catalog, checkout, cardPayment, flights }),
    )
  const tripsDatabase: TripsDatabaseRuntime = {
    withDb: (bindings, operation) =>
      host.primitives.database.transaction(bindings, (database) => operation(database as never)),
  }
  return {
    [commerceCardPaymentRuntimePort.id]: cardPayment,
    [storefrontPaymentLinkRuntimePort.id]: createStandardPaymentLinkRouteOptions(),
    [tripsRoutesRuntimePort.id]: tripsRoutes,
    [tripsDatabaseRuntimePort.id]: tripsDatabase,
  }
}
