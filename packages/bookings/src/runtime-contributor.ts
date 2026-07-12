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

/** Package-owned registration map for Bookings deployment adapters. */
export function createBookingsRuntimePortContribution(
  contribution: BookingsRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return {
    [bookingsRuntimePort.id]: contribution.bookings,
    [bookingRequirementsRuntimePort.id]: contribution.requirements,
  }
}
