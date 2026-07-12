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
  host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createBookingsStandardNodeRuntime(host.primitives),
  )
  return {
    [bookingsRuntimePort.id]: runtime.then((value) => value.bookings),
    [bookingRequirementsRuntimePort.id]: runtime.then((value) => value.requirements),
  }
}
