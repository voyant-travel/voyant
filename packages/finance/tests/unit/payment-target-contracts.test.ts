import { describe, expect, it } from "vitest"

import { derivePaymentSessionTarget } from "../../src/service-shared.js"
import {
  insertPaymentAuthorizationSchema,
  insertPaymentSessionSchema,
  paymentAuthorizationListQuerySchema,
  paymentSessionListQuerySchema,
} from "../../src/validation.js"

describe("payment target contracts", () => {
  it("accepts explicit session target and provenance without exposing orderId", () => {
    const parsed = insertPaymentSessionSchema.parse({
      target: { type: "invoice", invoiceId: "inv_123" },
      provenance: { source: "storefront", provider: "booking-engine", reference: "cart_123" },
      currency: "EUR",
      amountCents: 12345,
    })

    expect(parsed).toMatchObject({
      target: { type: "invoice", invoiceId: "inv_123" },
      provenance: { source: "storefront", provider: "booking-engine", reference: "cart_123" },
    })
    expect(parsed).not.toHaveProperty("orderId")
    expect(derivePaymentSessionTarget(parsed)).toEqual({
      targetType: "invoice",
      targetId: "inv_123",
    })
  })

  it("keeps legacy order references behind legacyOrderId compatibility", () => {
    const parsed = insertPaymentSessionSchema.parse({
      legacyOrderId: "ord_123",
      currency: "EUR",
      amountCents: 12345,
    })

    expect(parsed).toMatchObject({ legacyOrderId: "ord_123" })
    expect(parsed).not.toHaveProperty("orderId")
    expect(derivePaymentSessionTarget(parsed)).toEqual({
      targetType: "order",
      targetId: "ord_123",
    })

    expect(paymentSessionListQuerySchema.parse({ legacyOrderId: "ord_123" })).toMatchObject({
      legacyOrderId: "ord_123",
    })

    expect(() =>
      insertPaymentSessionSchema.parse({
        orderId: "ord_123",
        currency: "EUR",
        amountCents: 12345,
      }),
    ).toThrow()
    expect(() => paymentSessionListQuerySchema.parse({ orderId: "ord_123" })).toThrow()
  })

  it("uses the same explicit target and legacy compatibility for authorizations", () => {
    expect(
      insertPaymentAuthorizationSchema.parse({
        target: { type: "booking_guarantee", bookingGuaranteeId: "bkg_123" },
        provenance: { source: "operator" },
        currency: "EUR",
        amountCents: 1,
      }),
    ).toMatchObject({
      target: { type: "booking_guarantee", bookingGuaranteeId: "bkg_123" },
      provenance: { source: "operator" },
    })

    expect(paymentAuthorizationListQuerySchema.parse({ legacyOrderId: "ord_123" })).toMatchObject({
      legacyOrderId: "ord_123",
    })
    expect(() => paymentAuthorizationListQuerySchema.parse({ orderId: "ord_123" })).toThrow()
  })
})
