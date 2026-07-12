import { commerceCardPaymentRuntimePort } from "@voyant-travel/commerce/runtime-port"
import { storefrontPaymentLinkRuntimePort } from "@voyant-travel/storefront"
import type { TripsRoutesOptionsProvider } from "./routes.js"
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
  capabilities: {
    createTripsRoutesOptions: TripsRoutesOptionsProvider
    withDb: TripsDatabaseRuntime["withDb"]
  }
}

/** Package-owned registration map for Trips deployment adapters. */
export function createTripsRuntimePortContribution(
  host: TripsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const tripsDatabase: TripsDatabaseRuntime = { withDb: host.capabilities.withDb }
  return {
    [commerceCardPaymentRuntimePort.id]: createCommerceCardPaymentRuntime(),
    [storefrontPaymentLinkRuntimePort.id]: createStandardPaymentLinkRouteOptions(),
    [tripsRoutesRuntimePort.id]: host.capabilities.createTripsRoutesOptions,
    [tripsDatabaseRuntimePort.id]: tripsDatabase,
  }
}
