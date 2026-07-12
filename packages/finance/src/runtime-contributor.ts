import {
  type ActionLedgerFinanceDriftRuntime,
  actionLedgerFinanceDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import {
  type BookingsFinanceRuntime,
  bookingsFinanceRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { checkFinanceActionLedgerDrift } from "./action-ledger-drift.js"
import { financeHostRuntimePort } from "./runtime-port.js"
import { createFinanceStaleBookingHoldsRuntime } from "./stale-booking-holds-runtime.js"

export interface FinanceRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Provide Finance's generic host input and its narrow Bookings integration. */
export function createFinanceRuntimePortContribution(
  host: FinanceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerFinanceDriftRuntimePort.id]: {
      checkFinanceDrift: checkFinanceActionLedgerDrift,
    } satisfies ActionLedgerFinanceDriftRuntime,
    [financeHostRuntimePort.id]: { primitives: host.primitives },
    [bookingsFinanceRuntimePort.id]: {
      createStaleBookingHoldsRuntime: createFinanceStaleBookingHoldsRuntime,
    } satisfies BookingsFinanceRuntime,
  }
}
