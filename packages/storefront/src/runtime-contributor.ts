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

export interface StorefrontRuntimeContributorHost {
  capabilities: {
    loadStorefrontRuntime(): RuntimePortValue<StorefrontRuntimePortContribution>
  }
}

/** Package-owned registration map for Storefront deployment adapters. */
export function createStorefrontRuntimePortContribution(
  host: StorefrontRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const contribution = Promise.resolve(host.capabilities.loadStorefrontRuntime())
  return {
    [storefrontRuntimePort.id]: contribution.then((runtime) => runtime.storefront),
    [storefrontPaymentLinkRuntimePort.id]: contribution.then((runtime) => runtime.paymentLink),
    [storefrontCustomerPortalRuntimePort.id]: contribution.then(
      (runtime) => runtime.customerPortal,
    ),
    [storefrontVerificationRuntimePort.id]: contribution.then((runtime) => runtime.verification),
  }
}
