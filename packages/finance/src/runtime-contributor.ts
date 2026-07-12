import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { BookingTaxRouteOptions } from "./booking-tax.js"
import type { FinanceHonoModuleOptions } from "./index.js"
import type { FinanceBookingScheduleRuntime } from "./runtime-port.js"
import {
  financeBookingScheduleRuntimePort,
  financeBookingTaxRuntimePort,
  financeRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface FinanceRuntimePortContribution {
  finance: RuntimePortValue<FinanceHonoModuleOptions>
  bookingSchedule: RuntimePortValue<FinanceBookingScheduleRuntime>
  bookingTax: RuntimePortValue<BookingTaxRouteOptions>
}

export interface FinanceRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Finance defaults lowered from the generic runtime host. */
export function createFinanceRuntimePortContribution(
  host: FinanceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createFinanceStandardNodeRuntime(host.primitives),
  )
  return {
    [financeRuntimePort.id]: runtime.then((value) => value.finance),
    [financeBookingScheduleRuntimePort.id]: runtime.then((value) => value.bookingSchedule),
    [financeBookingTaxRuntimePort.id]: runtime.then((value) => value.bookingTax),
  }
}
