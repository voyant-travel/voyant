import { describe, expect, it } from "vitest"
import { insertOfferSchema, orderStatusSchema, transactionItemTypeSchema } from "./index.js"

describe("transactions-contracts", () => {
  it("accepts valid enum and schema payloads", () => {
    expect(orderStatusSchema.parse("confirmed")).toBe("confirmed")
    expect(transactionItemTypeSchema.parse("service")).toBe("service")

    const offer = insertOfferSchema.parse({
      offerNumber: "OF-001",
      title: "Sample offer",
      currency: "USD",
    })
    expect(offer.status).toBe("draft")
    expect(offer.totalAmountCents).toBe(0)
  })

  it("rejects invalid enum and schema payloads", () => {
    expect(orderStatusSchema.safeParse("shipped").success).toBe(false)
    expect(transactionItemTypeSchema.safeParse("nope").success).toBe(false)
    expect(insertOfferSchema.safeParse({ title: "Missing fields" }).success).toBe(false)
  })
})
