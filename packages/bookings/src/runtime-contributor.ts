import {
  type ActionLedgerBookingDriftRuntime,
  actionLedgerBookingDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { checkBookingActionLedgerDrift } from "./action-ledger-drift.js"
import { bookingsConfigurationRuntimePort } from "./runtime-port.js"

export interface BookingsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Bind Bookings' configuration input; domain behavior arrives through graph ports. */
export function createBookingsRuntimePortContribution(
  host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerBookingDriftRuntimePort.id]: {
      checkBookingDrift: checkBookingActionLedgerDrift,
    } satisfies ActionLedgerBookingDriftRuntime,
    [bookingsConfigurationRuntimePort.id]: {
      readConfig: host.primitives.config.read,
    },
  }
}
