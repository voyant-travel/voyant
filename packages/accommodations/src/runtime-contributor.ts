import {
  type BookingsAccommodationRuntime,
  bookingsAccommodationRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  type FinanceAccommodationsPaymentPolicyRuntime,
  financeAccommodationsPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { catalogAccommodationsRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { enrichStayBookingOverviewItems } from "./booking-overview-enricher.js"
import { catalogAccommodationsRuntimeExtension } from "./catalog-runtime-extension.js"
import {
  resolveAccommodationBookingPaymentPolicy,
  resolveAccommodationEntityPaymentPolicy,
} from "./payment-policy-runtime.js"

/** Statically provide Accommodations' narrow cross-domain runtime contributions. */
export function createAccommodationsRuntimePortContribution(
  _host: object,
): Readonly<Record<string, unknown>> {
  return {
    [catalogAccommodationsRuntimeExtensionPort.id]: catalogAccommodationsRuntimeExtension,
    [bookingsAccommodationRuntimePort.id]: {
      enrichOverviewItems: enrichStayBookingOverviewItems,
    } satisfies BookingsAccommodationRuntime,
    [financeAccommodationsPaymentPolicyRuntimePort.id]: {
      resolveBookingPolicy: resolveAccommodationBookingPaymentPolicy,
      resolveEntityPolicy: resolveAccommodationEntityPaymentPolicy,
    } satisfies FinanceAccommodationsPaymentPolicyRuntime,
  }
}
