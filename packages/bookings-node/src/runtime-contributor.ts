import type { BookingRequirementsHonoModuleOptions } from "@voyant-travel/bookings/requirements"
import {
  type BookingsRuntimeProvider,
  bookingRequirementsRuntimePort,
  bookingsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

type RuntimePortValue<T> = T | Promise<T>

export interface BookingsRuntimePortContribution {
  bookings: RuntimePortValue<BookingsRuntimeProvider>
  requirements: RuntimePortValue<BookingRequirementsHonoModuleOptions>
}

export interface BookingsNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

export function createBookingsNodeRuntimePortContribution(
  host: BookingsNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createBookingsStandardNodeRuntime(host.primitives),
  )
  return {
    [bookingsRuntimePort.id]: runtime.then((value) => value.bookings),
    [bookingRequirementsRuntimePort.id]: runtime.then((value) => value.requirements),
  }
}
