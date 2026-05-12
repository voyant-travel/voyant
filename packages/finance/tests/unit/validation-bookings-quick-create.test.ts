import { describe, expect, it } from "vitest"

import { quickCreateBookingSchema } from "../../src/service-bookings-quick-create.js"

describe("quickCreateBookingSchema", () => {
  const valid = {
    productId: "prod_123",
    bookingNumber: "BK-001",
  }

  it("accepts a confirmed catalog total without an override reason", () => {
    const result = quickCreateBookingSchema.parse({
      ...valid,
      catalogSellAmountCents: 20000,
      confirmedSellAmountCents: 20000,
    })

    expect(result.confirmedSellAmountCents).toBe(20000)
  })

  it("requires a reason when the confirmed total differs from catalog pricing", () => {
    expect(() =>
      quickCreateBookingSchema.parse({
        ...valid,
        catalogSellAmountCents: 20000,
        confirmedSellAmountCents: 17500,
      }),
    ).toThrow()
  })
})
