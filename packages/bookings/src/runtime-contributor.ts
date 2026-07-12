import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { bookingsConfigurationRuntimePort } from "./runtime-port.js"

export interface BookingsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Bind Bookings' configuration input; domain behavior arrives through graph ports. */
export function createBookingsRuntimePortContribution(
  host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [bookingsConfigurationRuntimePort.id]: {
      readConfig: host.primitives.config.read,
    },
  }
}
