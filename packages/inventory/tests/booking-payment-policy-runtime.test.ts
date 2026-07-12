import { describe, expect, it } from "vitest"

import {
  createInventoryPaymentPolicyRuntime,
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "../src/booking-payment-policy-runtime"

const runtime = createInventoryPaymentPolicyRuntime({
  resolveSupplierPolicy: async () => null,
  resolveSupplierPolicyById: async () => null,
  resolveVerticalListingPolicy: async () => null,
  resolveVerticalListingPolicyForEntity: async () => null,
  resolveVerticalSupplierPolicyForEntity: async () => null,
})

describe("inventory payment-policy runtime", () => {
  it("retains the finance source marker protocol", () => {
    expect(typeof stampPolicySourceOnBooking).toBe("function")
    expect(readPolicySourceFromInternalNotes("__payment_policy_source__:supplier")).toBe("supplier")
    expect(readPolicySourceFromInternalNotes("customer note")).toBeNull()
  })

  it("composes the complete policy cascade from package-owned readers", () => {
    for (const reader of [
      runtime.resolveSupplierPolicy,
      runtime.resolveCategoryPolicy,
      runtime.resolveListingPolicy,
      runtime.resolveSupplierPolicyForEntity,
      runtime.resolveCategoryPolicyForEntity,
      runtime.resolveListingPolicyForEntity,
      runtime.bookingPaymentPolicyCascade.resolveSupplierPolicy,
      runtime.bookingPaymentPolicyCascade.resolveListingPolicyForEntity,
    ]) {
      expect(typeof reader).toBe("function")
    }
  })
})
