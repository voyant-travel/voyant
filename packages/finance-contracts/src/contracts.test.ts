import { describe, expect, it } from "vitest"

import { invoiceStatusSchema, paymentMethodSchema } from "./index.js"

describe("finance-contracts", () => {
  it("accepts valid enum values", () => {
    expect(invoiceStatusSchema.parse("issued")).toBe("issued")
    expect(paymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer")
  })

  it("rejects invalid enum values", () => {
    expect(invoiceStatusSchema.safeParse("settled").success).toBe(false)
    expect(paymentMethodSchema.safeParse("bitcoin").success).toBe(false)
  })
})
