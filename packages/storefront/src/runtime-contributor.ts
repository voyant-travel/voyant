import { customerBusinessAccountOnboardingRuntimePort } from "@voyant-travel/auth/customer-business-onboarding-runtime-port"
import { createCommerceStorefrontOfferResolvers } from "@voyant-travel/commerce"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createStorefrontCustomerBusinessOnboardingRuntime } from "./customer-business-onboarding-runtime.js"
import {
  type StorefrontBookingIntentsRuntime,
  storefrontBookingIntentsRuntimePort,
  storefrontCustomerPortalRuntimePort,
  storefrontOffersRuntimePort,
} from "./runtime-port.js"

export interface StorefrontRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  hasRuntimePort?(port: { id: string }): boolean
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
    ...(host.hasRuntimePort?.(customerBusinessAccountOnboardingRuntimePort)
      ? {}
      : {
          [customerBusinessAccountOnboardingRuntimePort.id]:
            createStorefrontCustomerBusinessOnboardingRuntime(),
        }),
  }
}
