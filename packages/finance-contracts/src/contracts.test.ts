import { describe, expect, it } from "vitest"

import {
  insertPaymentSchema,
  invoiceStatusSchema,
  paymentMethodSchema,
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
})
