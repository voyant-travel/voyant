import { createCommerceStorefrontOfferResolvers } from "@voyant-travel/commerce"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  type StorefrontBookingIntentsRuntime,
  storefrontBookingIntentsRuntimePort,
  storefrontCustomerPortalRuntimePort,
  storefrontOffersRuntimePort,
} from "./runtime-port.js"

export interface StorefrontRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Storefront-owned adapters derived exclusively from generic Node primitives. */
export function createStorefrontRuntimePortContribution(
  host: StorefrontRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const bookingIntents = {
    withDb: (bindings, operation) =>
      host.primitives.database.transaction(bindings, (database) =>
        operation(database as PostgresJsDatabase),
      ),
  } satisfies StorefrontBookingIntentsRuntime
  return {
    [storefrontOffersRuntimePort.id]: createCommerceStorefrontOfferResolvers(),
    [storefrontBookingIntentsRuntimePort.id]: bookingIntents,
    [storefrontCustomerPortalRuntimePort.id]: {
      resolveDocumentDownloadUrl: host.primitives.storage.downloadUrl,
    },
  }
}
