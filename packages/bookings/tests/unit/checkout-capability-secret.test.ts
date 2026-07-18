import { describe, expect, it } from "vitest"

import {
  issueCheckoutCapability,
  resolveCheckoutCapabilitySecret,
  resolveCheckoutCapabilityTtlSeconds,
  resolveGuestBookingAccessSecret,
  resolveGuestBookingAccessTtlSeconds,
} from "../../src/checkout-capability.js"

describe("checkout capability secret", () => {
  it("does not reuse either auth realm signing root", () => {
    expect(
      resolveCheckoutCapabilitySecret({
        SESSION_CLAIMS_ADMIN_SECRET: "admin-claims-secret-must-not-be-used",
        SESSION_CLAIMS_CUSTOMER_SECRET: "customer-claims-secret-must-not-be-used",
      }),
    ).toBe("")
  })

  it("fails closed when its dedicated secret is missing", async () => {
    await expect(issueCheckoutCapability("booking_1", {})).rejects.toThrow(
      "Public capability secret must be at least 32 characters",
    )
  })

  it("ignores non-canonical capability aliases", () => {
    expect(resolveCheckoutCapabilitySecret({ CHECKOUT_CAPABILITY_SECRET: "legacy" })).toBe("")
    expect(resolveCheckoutCapabilityTtlSeconds({ CHECKOUT_CAPABILITY_TTL_SECONDS: "60" })).toBe(
      30 * 60,
    )
    expect(resolveGuestBookingAccessSecret({ GUEST_BOOKING_ACCESS_SECRET: "legacy" })).toBe("")
    expect(resolveGuestBookingAccessTtlSeconds({ GUEST_BOOKING_ACCESS_TTL_SECONDS: "60" })).toBe(
      30 * 60,
    )
  })
})
