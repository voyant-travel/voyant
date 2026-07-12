import {
  type BookingsAccommodationRuntime,
  bookingsAccommodationRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import { enrichStayBookingOverviewItems } from "./booking-overview-enricher.js"

/** Statically provide Accommodations' narrow contribution to the Bookings runtime. */
export function createAccommodationsRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [bookingsAccommodationRuntimePort.id]: {
      enrichOverviewItems: enrichStayBookingOverviewItems,
    } satisfies BookingsAccommodationRuntime,
  }
}
