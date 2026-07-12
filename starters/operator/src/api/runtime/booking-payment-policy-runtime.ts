import {
  resolveAccommodationBookingPaymentPolicy,
  resolveAccommodationEntityPaymentPolicy,
} from "@voyant-travel/accommodations/payment-policy-runtime"
import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "@voyant-travel/cruises/payment-policy-runtime"
import {
  resolveBookingSupplierPaymentPolicy,
  resolveSupplierPaymentPolicyById,
} from "@voyant-travel/distribution/payment-policy-runtime"
import {
  createInventoryPaymentPolicyRuntime,
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "@voyant-travel/inventory/booking-payment-policy-runtime"

const runtime = createInventoryPaymentPolicyRuntime({
  resolveSupplierPolicy: resolveBookingSupplierPaymentPolicy,
  resolveSupplierPolicyById: resolveSupplierPaymentPolicyById,
  resolveVerticalListingPolicy: async (db, bookingId) =>
    (await resolveCruiseBookingPaymentPolicy(db, bookingId)) ??
    resolveAccommodationBookingPaymentPolicy(db, bookingId),
  resolveVerticalListingPolicyForEntity: async (db, context) =>
    (await resolveCruiseEntityPaymentPolicy(db, context)) ??
    resolveAccommodationEntityPaymentPolicy(db, context),
  resolveVerticalSupplierPolicyForEntity: async (db, context) => {
    const supplierId = await resolveCruiseSupplierId(db, context)
    return supplierId ? resolveSupplierPaymentPolicyById(db, supplierId) : null
  },
})

export const {
  bookingPaymentPolicyCascade,
  resolveCategoryPolicy,
  resolveCategoryPolicyForEntity,
  resolveListingPolicy,
  resolveListingPolicyForEntity,
  resolveSupplierPolicy,
  resolveSupplierPolicyForEntity,
} = runtime

export { readPolicySourceFromInternalNotes, stampPolicySourceOnBooking }
