import { describe, expect, it } from "vitest"

import { bookingReservationPaymentIntentV1 } from "./engine-contracts.js"

describe("bookingReservationPaymentIntentV1", () => {
  it("accepts reservation intents", () => {
    expect(bookingReservationPaymentIntentV1.safeParse({ type: "hold" }).success).toBe(true)
    expect(
      bookingReservationPaymentIntentV1.safeParse({
        type: "card",
        tokenizedCard: "tok_123",
      }).success,
    ).toBe(true)
  })

  it.each(["bank_transfer", "inquiry"])("rejects checkout-only %s", (type) => {
    expect(bookingReservationPaymentIntentV1.safeParse({ type }).success).toBe(false)
  })
})
