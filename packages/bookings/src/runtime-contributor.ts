import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
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
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Bookings defaults lowered from the generic runtime host. */
export function createBookingsRuntimePortContribution(
  _host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime: BookingsRuntimePortContribution = {
    bookings: { options: {} },
    requirements: {},
  }
  return {
    [bookingsRuntimePort.id]: runtime.bookings,
    [bookingRequirementsRuntimePort.id]: runtime.requirements,
  }
}
