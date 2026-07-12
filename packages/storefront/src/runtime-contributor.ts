import type { PublicCustomerPortalRouteOptions } from "./customer-portal/routes-public.js"
import type { StorefrontHonoModuleOptions } from "./index.js"
import type { PaymentLinkRoutesOptions } from "./payment-link/routes.js"
import {
  storefrontCustomerPortalRuntimePort,
  storefrontPaymentLinkRuntimePort,
  storefrontRuntimePort,
  storefrontVerificationRuntimePort,
} from "./runtime-port.js"
import type { StorefrontVerificationRoutesOptions } from "./verification/routes-public.js"

type RuntimePortValue<T> = T | Promise<T>

export interface StorefrontRuntimePortContribution {
  storefront: RuntimePortValue<NonNullable<StorefrontHonoModuleOptions>>
  paymentLink: RuntimePortValue<PaymentLinkRoutesOptions>
  customerPortal: RuntimePortValue<PublicCustomerPortalRouteOptions>
  verification: RuntimePortValue<StorefrontVerificationRoutesOptions>
}

/** Package-owned registration map for Storefront deployment adapters. */
export function createStorefrontRuntimePortContribution(
  contribution: StorefrontRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [storefrontRuntimePort.id]: contribution.storefront,
    [storefrontPaymentLinkRuntimePort.id]: contribution.paymentLink,
    [storefrontCustomerPortalRuntimePort.id]: contribution.customerPortal,
    [storefrontVerificationRuntimePort.id]: contribution.verification,
  }
}
