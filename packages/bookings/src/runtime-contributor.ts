import {
  type ActionLedgerBookingDriftRuntime,
  actionLedgerBookingDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { checkBookingActionLedgerDrift } from "./action-ledger-drift.js"

export interface BookingsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Bind Bookings-owned runtime behavior; domain behavior arrives through graph ports. */
export function createBookingsRuntimePortContribution(
  _host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerBookingDriftRuntimePort.id]: {
      checkBookingDrift: checkBookingActionLedgerDrift,
    } satisfies ActionLedgerBookingDriftRuntime,
  }
}
