import {
  type BookingsFinanceRuntime,
  bookingsFinanceRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { FinanceHonoModuleOptions } from "@voyant-travel/finance"
import type { BookingTaxRouteOptions } from "@voyant-travel/finance/booking-tax"
import {
  type FinanceBookingScheduleRuntime,
  financeBookingScheduleRuntimePort,
  financeBookingTaxRuntimePort,
  financeRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { createFinanceStaleBookingHoldsRuntime } from "@voyant-travel/finance/stale-booking-holds-runtime"

type RuntimePortValue<T> = T | Promise<T>

export interface FinanceRuntimePortContribution {
  finance: RuntimePortValue<FinanceHonoModuleOptions>
  bookingSchedule: RuntimePortValue<FinanceBookingScheduleRuntime>
  bookingTax: RuntimePortValue<BookingTaxRouteOptions>
}

export interface FinanceNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

export function createFinanceNodeRuntimePortContribution(
  host: FinanceNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createFinanceStandardNodeRuntime(host.primitives),
  )
  return {
    [financeRuntimePort.id]: runtime.then((value) => value.finance),
    [financeBookingScheduleRuntimePort.id]: runtime.then((value) => value.bookingSchedule),
    [financeBookingTaxRuntimePort.id]: runtime.then((value) => value.bookingTax),
    [bookingsFinanceRuntimePort.id]: {
      createStaleBookingHoldsRuntime: createFinanceStaleBookingHoldsRuntime,
    } satisfies BookingsFinanceRuntime,
  }
}
