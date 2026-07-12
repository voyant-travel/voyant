import type { BookingRequirementsHonoModuleOptions } from "./requirements/index.js"
import {
  type BookingsRuntimeProvider,
  bookingRequirementsRuntimePort,
  bookingsRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface BookingsRuntimePortContribution {
  bookings: RuntimePortValue<BookingsRuntimeProvider>
  requirements: RuntimePortValue<BookingRequirementsHonoModuleOptions>
}

export interface BookingsRuntimeContributorHost {
  capabilities: {
    loadBookingsRuntime(): RuntimePortValue<BookingsRuntimeProvider>
    loadBookingRequirementsRuntime(): RuntimePortValue<BookingRequirementsHonoModuleOptions>
  }
}

/** Package-owned registration map for Bookings deployment adapters. */
export function createBookingsRuntimePortContribution(
  host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [bookingsRuntimePort.id]: host.capabilities.loadBookingsRuntime(),
    [bookingRequirementsRuntimePort.id]: host.capabilities.loadBookingRequirementsRuntime(),
  }
}
