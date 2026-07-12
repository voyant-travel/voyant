import { catalogCruisesRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import {
  type FinanceCruisesPaymentPolicyRuntime,
  financeCruisesPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import { catalogCruisesRuntimeExtension } from "./catalog-runtime-extension.js"
import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "./payment-policy-runtime.js"

/** Provide Cruises' narrow Catalog and Finance runtime contracts. */
export function createCruisesRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [catalogCruisesRuntimeExtensionPort.id]: catalogCruisesRuntimeExtension,
    [financeCruisesPaymentPolicyRuntimePort.id]: {
      resolveBookingPolicy: resolveCruiseBookingPaymentPolicy,
      resolveEntityPolicy: resolveCruiseEntityPaymentPolicy,
      resolveSupplierId: resolveCruiseSupplierId,
    } satisfies FinanceCruisesPaymentPolicyRuntime,
  }
}
