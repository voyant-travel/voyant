import { describe, expect, it } from "vitest"

import {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  type AccommodationContent,
  accommodationContentSchema,
  BOARD_BASIS_SHORT_CODES,
  validateAccommodationContent,
} from "./index.js"

describe("@voyant-travel/accommodations-contracts content shape", () => {
  it("validates the accommodations/v1 rich content payload", () => {
    const content = accommodationContentSchema.parse({
      hotel: { id: "hrmt_abc", name: "Hotel Sample", star_rating: 4 },
      room_types: [{ id: "hrmt_std", name: "Standard Double", max_adults: 2 }],
      meal_plans: [{ id: "mp_bb", name: "Bed & Breakfast", basis: "bed_breakfast" }],
      policies: [{ kind: "check_in", body: "Check-in from 14:00." }],
    }) satisfies AccommodationContent

    expect(ACCOMMODATION_CONTENT_SCHEMA_VERSION).toBe("accommodations/v1")
    expect(BOARD_BASIS_SHORT_CODES.bed_breakfast).toBe("BB")
    expect(validateAccommodationContent(content)).toMatchObject({ valid: true })
    expect(content.rate_plans).toEqual([])
    expect(content.room_types[0]?.amenities).toEqual([])
  })

  it("defaults rate-plan charge frequency to per_night", () => {
    const content = accommodationContentSchema.parse({
      hotel: { id: "hrmt_abc", name: "Hotel Sample" },
      rate_plans: [{ id: "hrpl_bar", name: "Best Available Rate" }],
    }) satisfies AccommodationContent

    expect(content.rate_plans[0]?.charge_frequency).toBe("per_night")
  })

  it("rejects payloads missing the required hotel summary", () => {
    expect(validateAccommodationContent({ room_types: [] })).toMatchObject({ valid: false })
    expect(validateAccommodationContent({ hotel: { id: "h" } })).toMatchObject({ valid: false })
  })

  it("rejects unknown policy kinds", () => {
    expect(
      validateAccommodationContent({
        hotel: { id: "hrmt_abc", name: "Hotel Sample" },
        policies: [{ kind: "loyalty", body: "x" }],
      }),
    ).toMatchObject({ valid: false })
  })

  it("rejects unknown meal-plan board basis values", () => {
    expect(
      validateAccommodationContent({
        hotel: { id: "hrmt_abc", name: "Hotel Sample" },
        meal_plans: [{ id: "mp_x", name: "Mystery", basis: "brunch_only" }],
      }),
    ).toMatchObject({ valid: false })
  })
})
