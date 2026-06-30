import type { BookingDraftShape } from "@voyant-travel/catalog-contracts/booking-engine/draft-shape"
import { describe, expect, it } from "vitest"

import { normalizeBookingDraftShape } from "./use-booking-draft-shape.js"

const fallbackShape: BookingDraftShape = {
  showsConfigure: true,
  showsBilling: true,
  showsTravelers: true,
  showsAccommodation: false,
  showsAddons: false,
  showsPayment: true,
  showsReview: true,
  configureSubSteps: [{ kind: "departure", required: true }],
  paxBands: [{ code: "adult", label: "Adult", minCount: 1, maxCount: 8 }],
  paxBandsAllowedTotal: { min: 1, max: 8 },
  travelerFields: [{ key: "firstName", label: "First name", type: "text", required: true }],
  bookingFields: [
    { key: "buyerType", label: "Buyer type", type: "select", required: true, group: "billing" },
  ],
  paymentIntents: ["hold", "card"],
}

describe("normalizeBookingDraftShape", () => {
  it("returns the fallback when the quote has no shape", () => {
    expect(normalizeBookingDraftShape(undefined, fallbackShape)).toBe(fallbackShape)
  })

  it("drops malformed configure sub-step entries before journey code reads kind", () => {
    const shape = normalizeBookingDraftShape(
      {
        ...fallbackShape,
        configureSubSteps: [
          undefined,
          null,
          { kind: "product-option", options: [{ id: "opt_1", name: "Standard" }] },
          { kind: "option-units" },
        ],
      },
      fallbackShape,
    )

    expect(shape.configureSubSteps?.map((step) => step.kind)).toEqual([
      "product-option",
      "option-units",
    ])
  })

  it("falls back when required descriptor fields are malformed", () => {
    const shape = normalizeBookingDraftShape(
      {
        showsBilling: false,
        configureSubSteps: [undefined],
        paxBands: [{ code: "", label: "Broken" }],
        travelerFields: [{ key: "passport" }],
        paymentIntents: ["bogus"],
      },
      fallbackShape,
    )

    expect(shape.showsBilling).toBe(fallbackShape.showsBilling)
    expect(shape.configureSubSteps).toEqual(fallbackShape.configureSubSteps)
    expect(shape.paxBands).toEqual(fallbackShape.paxBands)
    expect(shape.travelerFields).toEqual(fallbackShape.travelerFields)
    expect(shape.paymentIntents).toEqual(fallbackShape.paymentIntents)
  })
})
