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

/** Package-owned registration map for Finance deployment adapters. */
export function createFinanceRuntimePortContribution(
  contribution: FinanceRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [financeRuntimePort.id]: contribution.finance,
    [financeBookingScheduleRuntimePort.id]: contribution.bookingSchedule,
    [financeBookingTaxRuntimePort.id]: contribution.bookingTax,
  }
}
