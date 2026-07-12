import { catalogDistributionRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import {
  type FinanceDistributionPaymentPolicyRuntime,
  financeDistributionPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import { catalogDistributionRuntimeExtension } from "./catalog-runtime-extension.js"
import {
  resolveBookingSupplierPaymentPolicy,
  resolveSupplierPaymentPolicyById,
} from "./payment-policy-runtime.js"

/** Provide Distribution's narrow Catalog and Finance runtime contracts. */
export function createDistributionRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [catalogDistributionRuntimeExtensionPort.id]: catalogDistributionRuntimeExtension,
    [financeDistributionPaymentPolicyRuntimePort.id]: {
      resolveSupplierPolicy: resolveBookingSupplierPaymentPolicy,
      resolveSupplierPolicyById: resolveSupplierPaymentPolicyById,
    } satisfies FinanceDistributionPaymentPolicyRuntime,
  }
}
