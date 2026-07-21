import {
  type ActionLedgerFinanceDriftRuntime,
  actionLedgerFinanceDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import {
  type BookingsFinanceRuntime,
  bookingsFinanceRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { financeAppApiRuntimePort } from "@voyant-travel/finance-contracts/app-api"
import { checkFinanceActionLedgerDrift } from "./action-ledger-drift.js"
import { createFinanceAppApiRuntime } from "./app-api-runtime.js"
import { financeHostRuntimePort } from "./runtime-port.js"
import { createFinanceStaleBookingHoldsJobRuntime } from "./stale-booking-holds-runtime.js"

export interface FinanceRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Provide Finance's generic host input and its narrow Bookings integration. */
export function createFinanceRuntimePortContribution(
  host: FinanceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [financeAppApiRuntimePort.id]: createFinanceAppApiRuntime(host.primitives),
    [actionLedgerFinanceDriftRuntimePort.id]: {
      checkFinanceDrift: checkFinanceActionLedgerDrift,
    } satisfies ActionLedgerFinanceDriftRuntime,
    [financeHostRuntimePort.id]: { primitives: host.primitives },
    [bookingsFinanceRuntimePort.id]: {
      createStaleBookingHoldsJobRuntime: createFinanceStaleBookingHoldsJobRuntime,
    } satisfies BookingsFinanceRuntime,
  }
}
