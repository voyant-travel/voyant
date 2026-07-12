import {
  type FinanceCruisesPaymentPolicyRuntime,
  financeCruisesPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "./payment-policy-runtime.js"

/** Provide Cruises' payment-policy readers through Finance-owned contracts. */
export function createCruisesRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [financeCruisesPaymentPolicyRuntimePort.id]: {
      resolveBookingPolicy: resolveCruiseBookingPaymentPolicy,
      resolveEntityPolicy: resolveCruiseEntityPaymentPolicy,
      resolveSupplierId: resolveCruiseSupplierId,
    } satisfies FinanceCruisesPaymentPolicyRuntime,
  }
}
