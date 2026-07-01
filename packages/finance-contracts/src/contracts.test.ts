import { describe, expect, it } from "vitest"

import {
  insertBookingItemCommissionSchema,
  insertBookingItemTaxLineSchema,
  insertPaymentSchema,
  invoiceStatusSchema,
  paymentMethodSchema,
  taxClassListQuerySchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updatePaymentSchema,
} from "./index.js"

describe("finance-contracts", () => {
  it("accepts valid enum values", () => {
    expect(invoiceStatusSchema.parse("issued")).toBe("issued")
    expect(paymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer")
  })

  it("rejects invalid enum values", () => {
    expect(invoiceStatusSchema.safeParse("settled").success).toBe(false)
    expect(paymentMethodSchema.safeParse("bitcoin").success).toBe(false)
  })

  it("keeps payment idempotency keys create-only", () => {
    expect(
      insertPaymentSchema.parse({
        amountCents: 1000,
        currency: "USD",
        paymentMethod: "cash",
        paymentDate: "2026-06-09",
        idempotencyKey: "pay-create-1",
      }).idempotencyKey,
    ).toBe("pay-create-1")

    expect(updatePaymentSchema.parse({ idempotencyKey: "ignored" })).toEqual({})
  })

  it("parses false tax-class active query filters as false", () => {
    const result = taxClassListQuerySchema.parse({ active: "false" })

    expect(result.active).toBe(false)
  })

  it("rejects negative booking-item tax line amounts", () => {
    expect(
      insertBookingItemTaxLineSchema.safeParse({
        name: "VAT",
        currency: "USD",
        amountCents: -1,
      }).success,
    ).toBe(false)

    expect(updateBookingItemTaxLineSchema.safeParse({ amountCents: -1 }).success).toBe(false)
  })

  it("requires booking-item commission value basis by model", () => {
    expect(
      insertBookingItemCommissionSchema.safeParse({
        recipientType: "agency",
        commissionModel: "percentage",
      }).success,
    ).toBe(false)

    expect(
      insertBookingItemCommissionSchema.safeParse({
        recipientType: "agency",
        commissionModel: "fixed",
      }).success,
    ).toBe(false)

    expect(
      insertBookingItemCommissionSchema.safeParse({
        recipientType: "agency",
        commissionModel: "percentage",
        rateBasisPoints: 1000,
      }).success,
    ).toBe(true)

    expect(
      insertBookingItemCommissionSchema.safeParse({
        recipientType: "agency",
        commissionModel: "fixed",
        amountCents: 2500,
        currency: "USD",
      }).success,
    ).toBe(true)
  })

  it("requires settlement metadata when marking booking-item commissions paid", () => {
    expect(
      insertBookingItemCommissionSchema.safeParse({
        recipientType: "agency",
        commissionModel: "percentage",
        rateBasisPoints: 1000,
        status: "paid",
      }).success,
    ).toBe(false)

    expect(updateBookingItemCommissionSchema.safeParse({ status: "paid" }).success).toBe(false)

    expect(
      updateBookingItemCommissionSchema.safeParse({
        status: "paid",
        paidAt: "2026-06-30",
      }).success,
    ).toBe(true)
  })

  it("does not apply create defaults to booking-item commission patches", () => {
    const result = updateBookingItemCommissionSchema.parse({ notes: "internal note" })
    expect(result).toEqual({ notes: "internal note" })
  })
})
