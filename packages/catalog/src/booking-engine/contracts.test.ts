import { describe, expect, it } from "vitest"

import {
  bookingDraftV1,
  bookRequestV1,
  pricingBreakdownV1,
  quoteRequestV1,
  quoteResponseV1,
} from "./contracts.js"

describe("V1 contracts", () => {
  describe("bookingDraftV1", () => {
    it("accepts a minimal draft and applies defaults", () => {
      const result = bookingDraftV1.parse({
        entity: { module: "products", id: "prod_1", sourceKind: "owned" },
      })
      expect(result.configure.pax).toEqual({})
      expect(result.billing.buyerType).toBe("B2C")
      expect(result.payment.intent).toBe("hold")
      expect(result.travelers).toEqual([])
      expect(result.addons).toEqual([])
    })

    it("preserves explicit field values", () => {
      const result = bookingDraftV1.parse({
        entity: { module: "products", id: "prod_1", sourceKind: "owned" },
        configure: {
          pax: { adult: 2 },
          componentSelections: [
            {
              componentId: "pcmp_room",
              componentKind: "accommodation",
              choiceId: "double",
              optionId: "popt_room",
              optionUnitId: "ount_double",
            },
          ],
        },
        billing: {
          buyerType: "B2B",
          contact: { firstName: "Mihai", lastName: "U", email: "a@b.com" },
          address: { country: "RO" },
          company: { name: "Voyant" },
        },
      })
      expect(result.configure.pax.adult).toBe(2)
      expect(result.configure.componentSelections?.[0]).toEqual({
        componentId: "pcmp_room",
        componentKind: "accommodation",
        choiceId: "double",
        optionId: "popt_room",
        optionUnitId: "ount_double",
        quantity: 1,
      })
      expect(result.billing.buyerType).toBe("B2B")
      expect(result.billing.address.country).toBe("RO")
      expect(result.billing.company?.name).toBe("Voyant")
    })

    it("rejects malformed entity reference", () => {
      const result = bookingDraftV1.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe("quoteRequestV1", () => {
    it("validates a request without a draft", () => {
      const result = quoteRequestV1.safeParse({
        entityModule: "products",
        entityId: "prod_1",
        sourceKind: "owned",
        scope: { locale: "en-GB", audience: "staff", market: "default" },
      })
      expect(result.success).toBe(true)
    })

    it("requires audience to be one of the recognized actors", () => {
      const result = quoteRequestV1.safeParse({
        entityModule: "products",
        entityId: "prod_1",
        sourceKind: "owned",
        scope: { locale: "en-GB", audience: "robot", market: "default" },
      })
      expect(result.success).toBe(false)
    })
  })

  describe("bookRequestV1", () => {
    it("requires either quoteId or draftId", () => {
      expect(bookRequestV1.safeParse({}).success).toBe(false)
      expect(bookRequestV1.safeParse({ quoteId: "q1" }).success).toBe(true)
      expect(bookRequestV1.safeParse({ draftId: "d1" }).success).toBe(true)
    })

    it("rejects too-short idempotency keys", () => {
      const result = bookRequestV1.safeParse({ quoteId: "q1", idempotencyKey: "abc" })
      expect(result.success).toBe(false)
    })

    it("accepts idempotency keys in the 8–128 range", () => {
      expect(bookRequestV1.safeParse({ quoteId: "q1", idempotencyKey: "12345678" }).success).toBe(
        true,
      )
      expect(
        bookRequestV1.safeParse({ quoteId: "q1", idempotencyKey: "x".repeat(128) }).success,
      ).toBe(true)
      expect(
        bookRequestV1.safeParse({ quoteId: "q1", idempotencyKey: "x".repeat(129) }).success,
      ).toBe(false)
    })
  })

  describe("pricingBreakdownV1", () => {
    it("validates a populated breakdown", () => {
      const result = pricingBreakdownV1.safeParse({
        currency: "EUR",
        lines: [{ kind: "base", label: "Base", quantity: 2, unitAmount: 5000, totalAmount: 10000 }],
        taxes: [{ code: "vat", label: "VAT", rate: 0.19, amount: 1900, base: 10000 }],
        subtotal: 10000,
        taxTotal: 1900,
        total: 11900,
      })
      expect(result.success).toBe(true)
    })

    it("rejects bad currency length", () => {
      const result = pricingBreakdownV1.safeParse({
        currency: "EURO",
        lines: [],
        taxes: [],
        subtotal: 0,
        taxTotal: 0,
        total: 0,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("quoteResponseV1", () => {
    it("validates a minimal availability=false response", () => {
      const result = quoteResponseV1.safeParse({
        quoteId: "q1",
        quotedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        available: false,
        invalidReason: "out_of_stock",
      })
      expect(result.success).toBe(true)
    })

    it("validates component-choice configure descriptors", () => {
      const result = quoteResponseV1.safeParse({
        quoteId: "q1",
        quotedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        available: true,
        shape: {
          showsConfigure: true,
          showsBilling: true,
          showsTravelers: true,
          showsAccommodation: false,
          showsAddons: false,
          showsPayment: true,
          showsReview: true,
          paxBands: [{ code: "adult", label: "Adult", minCount: 1, maxCount: 8 }],
          paxBandsAllowedTotal: { min: 1, max: 8 },
          travelerFields: [],
          bookingFields: [],
          paymentIntents: ["hold"],
          configureSubSteps: [
            {
              kind: "component-choice",
              components: [
                {
                  componentId: "pcmp_room",
                  componentKind: "accommodation",
                  title: "Room choice",
                  selection: "choose_one",
                  commitmentBoundary: "internal",
                  priceDisposition: "included",
                  choices: [
                    {
                      id: "double",
                      title: "Double room",
                      pricingRef: {
                        optionId: "popt_room",
                        optionUnitId: "ount_double",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      })

      expect(result.success).toBe(true)
    })
  })
})
