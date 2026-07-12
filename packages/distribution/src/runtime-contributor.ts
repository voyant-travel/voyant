import {
  type FinanceDistributionPaymentPolicyRuntime,
  financeDistributionPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import {
  resolveBookingSupplierPaymentPolicy,
  resolveSupplierPaymentPolicyById,
} from "./payment-policy-runtime.js"

/** Provide Distribution's supplier policy readers through Finance-owned contracts. */
export function createDistributionRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [financeDistributionPaymentPolicyRuntimePort.id]: {
      resolveSupplierPolicy: resolveBookingSupplierPaymentPolicy,
      resolveSupplierPolicyById: resolveSupplierPaymentPolicyById,
    } satisfies FinanceDistributionPaymentPolicyRuntime,
  }
}
