import { describe, expect, it } from "vitest"

import {
  insertTravelCreditSchema,
  redeemTravelCreditSchema,
  travelCreditListQuerySchema,
  updateTravelCreditSchema,
} from "../../src/validation-travel-credits.js"

describe("insertTravelCreditSchema", () => {
  const valid = {
    currency: "EUR",
    amountCents: 5000,
    sourceType: "refund" as const,
  }

  it("accepts the minimum set", () => {
    const result = insertTravelCreditSchema.parse(valid)
    expect(result.currency).toBe("EUR")
    expect(result.amountCents).toBe(5000)
    expect(result.sourceType).toBe("refund")
  })

  it("requires currency, amountCents, sourceType", () => {
    expect(() => insertTravelCreditSchema.parse({})).toThrow()
    expect(() => insertTravelCreditSchema.parse({ ...valid, currency: "EU" })).toThrow()
    expect(() => insertTravelCreditSchema.parse({ ...valid, amountCents: 0 })).toThrow()
    expect(() => insertTravelCreditSchema.parse({ ...valid, amountCents: -1 })).toThrow()
    expect(() => insertTravelCreditSchema.parse({ ...valid, sourceType: "bogus" })).toThrow()
  })

  it("accepts optional fields", () => {
    const result = insertTravelCreditSchema.parse({
      ...valid,
      code: "GIFT-123",
      issuedToPersonId: "pers_abc",
      sourceBookingId: "book_abc",
      expiresAt: "2026-12-31T23:59:59.000Z",
      notes: "Goodwill credit",
    })
    expect(result.code).toBe("GIFT-123")
    expect(result.issuedToPersonId).toBe("pers_abc")
  })

  it("rejects non-datetime expiresAt", () => {
    expect(() => insertTravelCreditSchema.parse({ ...valid, expiresAt: "2026-12-31" })).toThrow()
  })
})

describe("updateTravelCreditSchema", () => {
  it("accepts partial updates", () => {
    expect(updateTravelCreditSchema.parse({}).status).toBeUndefined()
    expect(updateTravelCreditSchema.parse({ status: "void" }).status).toBe("void")
  })

  it("rejects unknown status", () => {
    expect(() => updateTravelCreditSchema.parse({ status: "active-ish" })).toThrow()
  })

  it("does not accept a balance override", () => {
    // remainingAmountCents is only mutated via `redeem` — the update schema
    // ignores unknown keys, so the field just drops out rather than mutating
    // the travel credit. Guarantee that in the parsed result.
    const result = updateTravelCreditSchema.parse({ remainingAmountCents: 0 }) as Record<
      string,
      unknown
    >
    expect(result.remainingAmountCents).toBeUndefined()
  })
})

describe("redeemTravelCreditSchema", () => {
  it("requires an idempotency key, bookingId, and positive amountCents", () => {
    expect(() => redeemTravelCreditSchema.parse({})).toThrow()
    expect(() => redeemTravelCreditSchema.parse({ bookingId: "book_1" })).toThrow()
    expect(() => redeemTravelCreditSchema.parse({ bookingId: "book_1", amountCents: 0 })).toThrow()
    expect(() =>
      redeemTravelCreditSchema.parse({
        idempotencyKey: "redeem-1",
        bookingId: "book_1",
        amountCents: -10,
      }),
    ).toThrow()
  })

  it("accepts optional paymentId", () => {
    const result = redeemTravelCreditSchema.parse({
      idempotencyKey: "redeem-1",
      bookingId: "book_1",
      amountCents: 1500,
      paymentId: "pay_abc",
    })
    expect(result.paymentId).toBe("pay_abc")
    expect(result.idempotencyKey).toBe("redeem-1")
  })
})

describe("travelCreditListQuerySchema", () => {
  it("applies default limit and offset", () => {
    const result = travelCreditListQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it("coerces hasBalance", () => {
    expect(travelCreditListQuerySchema.parse({ hasBalance: "true" }).hasBalance).toBe(true)
  })

  it("rejects unknown status", () => {
    expect(() => travelCreditListQuerySchema.parse({ status: "nope" })).toThrow()
  })
})
