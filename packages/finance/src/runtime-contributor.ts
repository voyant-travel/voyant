import {
  type BookingsFinanceRuntime,
  bookingsFinanceRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

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
    [financeHostRuntimePort.id]: { primitives: host.primitives },
    [bookingsFinanceRuntimePort.id]: {
      createStaleBookingHoldsRuntime: createFinanceStaleBookingHoldsRuntime,
    } satisfies BookingsFinanceRuntime,
  }
}
