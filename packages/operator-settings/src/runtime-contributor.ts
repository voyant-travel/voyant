import {
  type FinanceOperatorSettingsRuntime,
  financeOperatorSettingsRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import {
  resolveBookingTaxSettings,
  resolveOperatorDefaultPaymentPolicy,
  updateBookingTaxSettings,
} from "./service.js"

/** Provide operator-owned Finance settings through Finance's typed port. */
export function createOperatorSettingsRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [financeOperatorSettingsRuntimePort.id]: {
      resolveOperatorDefaultPaymentPolicy,
      resolveBookingTaxSettings,
      updateBookingTaxSettings,
    } satisfies FinanceOperatorSettingsRuntime,
  }
}
