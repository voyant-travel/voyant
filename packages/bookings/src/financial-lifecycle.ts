import type { ModuleContainer } from "@voyant-travel/core"

import type {
  ClosePaymentSchedulesForBooking,
  RecordCancellationFinancialSettlement,
} from "./route-runtime.js"

export const BOOKING_FINANCIAL_LIFECYCLE_KEY = "bookings.financial-lifecycle" as const

export interface BookingFinancialLifecycle {
  closePaymentSchedulesForBooking: ClosePaymentSchedulesForBooking
  recordCancellationFinancialSettlement: RecordCancellationFinancialSettlement
}

export function registerBookingFinancialLifecycle(
  container: ModuleContainer,
  lifecycle: BookingFinancialLifecycle,
): void {
  container.register(BOOKING_FINANCIAL_LIFECYCLE_KEY, lifecycle)
}

export function resolveBookingFinancialLifecycle(
  container: ModuleContainer,
): BookingFinancialLifecycle | undefined {
  return container.has(BOOKING_FINANCIAL_LIFECYCLE_KEY)
    ? container.resolve<BookingFinancialLifecycle>(BOOKING_FINANCIAL_LIFECYCLE_KEY)
    : undefined
}
