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
  capabilities: {
    loadFinanceRuntime(): RuntimePortValue<FinanceHonoModuleOptions>
    loadBookingScheduleRuntime(): RuntimePortValue<FinanceBookingScheduleRuntime>
    loadBookingTaxRuntime(): RuntimePortValue<BookingTaxRouteOptions>
  }
}

/** Package-owned registration map for Finance deployment adapters. */
export function createFinanceRuntimePortContribution(
  host: FinanceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [financeRuntimePort.id]: host.capabilities.loadFinanceRuntime(),
    [financeBookingScheduleRuntimePort.id]: host.capabilities.loadBookingScheduleRuntime(),
    [financeBookingTaxRuntimePort.id]: host.capabilities.loadBookingTaxRuntime(),
  }
}
