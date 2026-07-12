import {
  type CatalogRuntimeServices,
  catalogDistributionRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import {
  type FinanceDistributionPaymentPolicyRuntime,
  financeDistributionPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import { catalogDistributionRuntimeExtension } from "./catalog-runtime-extension.js"
import { channelPushRuntimePort } from "./channel-push/runtime-port.js"
import {
  resolveBookingSupplierPaymentPolicy,
  resolveSupplierPaymentPolicyById,
} from "./payment-policy-runtime.js"
import { createDistributionRuntime } from "./runtime.js"

export interface DistributionRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Provide Distribution's channel-push runtime and cross-domain contracts. */
export function createDistributionRuntimePortContribution(
  host: DistributionRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const channelPushRuntime = Promise.resolve()
    .then(() => host.getRuntimePort<CatalogRuntimeServices>(catalogRuntimeServicesPort))
    .then((services) => createDistributionRuntime(host.primitives, services))
  return {
    [channelPushRuntimePort.id]: channelPushRuntime,
    [catalogDistributionRuntimeExtensionPort.id]: catalogDistributionRuntimeExtension,
    [financeDistributionPaymentPolicyRuntimePort.id]: {
      resolveSupplierPolicy: resolveBookingSupplierPaymentPolicy,
      resolveSupplierPolicyById: resolveSupplierPaymentPolicyById,
    } satisfies FinanceDistributionPaymentPolicyRuntime,
  }
}
