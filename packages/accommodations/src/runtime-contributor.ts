import {
  type BookingsAccommodationRuntime,
  bookingsAccommodationRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  type FinanceAccommodationsPaymentPolicyRuntime,
  financeAccommodationsPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { enrichStayBookingOverviewItems } from "./booking-overview-enricher.js"
import {
  resolveAccommodationBookingPaymentPolicy,
  resolveAccommodationEntityPaymentPolicy,
} from "./payment-policy-runtime.js"

/** Statically provide Accommodations' narrow contribution to the Bookings runtime. */
export function createAccommodationsRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [bookingsAccommodationRuntimePort.id]: {
      enrichOverviewItems: enrichStayBookingOverviewItems,
    } satisfies BookingsAccommodationRuntime,
    [financeAccommodationsPaymentPolicyRuntimePort.id]: {
      resolveBookingPolicy: resolveAccommodationBookingPaymentPolicy,
      resolveEntityPolicy: resolveAccommodationEntityPaymentPolicy,
    } satisfies FinanceAccommodationsPaymentPolicyRuntime,
  }
}
