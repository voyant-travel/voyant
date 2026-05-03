import { describe, expect, it } from "vitest"

import {
  HOSPITALITY_CONTENT_SCHEMA_VERSION,
  type HospitalityContent,
  hospitalityContentSchema,
  mergeOverlaysIntoHospitalityContent,
  validateHospitalityContent,
} from "../../src/content-shape.js"

const baseContent: HospitalityContent = hospitalityContentSchema.parse({
  hotel: {
    id: "hrmt_abc",
    name: "Hotel Sample",
    star_rating: 4,
    country: "RO",
    city: "Cluj-Napoca",
  },
  room_types: [
    { id: "hrmt_std", name: "Standard Double", room_class: "standard", max_adults: 2 },
    { id: "hrmt_dlx", name: "Deluxe Suite", room_class: "suite", max_adults: 4 },
  ],
  rate_plans: [
    {
      id: "hrpl_bar",
      name: "Best Available Rate",
      charge_frequency: "per_night",
      cancellation_policy: "Free up to 24h.",
    },
  ],
  meal_plans: [{ id: "mp_bb", name: "Bed & Breakfast", basis: "bed_breakfast" }],
  amenities: [{ id: "wifi", name: "Free Wi-Fi", category: "connectivity" }],
  policies: [{ kind: "check_in", body: "Check-in from 14:00." }],
})

describe("HOSPITALITY_CONTENT_SCHEMA_VERSION", () => {
  it("is the hospitality/v1 stable identifier", () => {
    expect(HOSPITALITY_CONTENT_SCHEMA_VERSION).toBe("hospitality/v1")
  })
})

describe("validateHospitalityContent", () => {
  it("accepts a minimal valid payload (only required hotel.{id,name})", () => {
    expect(validateHospitalityContent({ hotel: { id: "hrmt_abc", name: "X" } }).valid).toBe(true)
  })

  it("accepts a full valid payload", () => {
    expect(validateHospitalityContent(baseContent).valid).toBe(true)
  })

  it("rejects missing hotel.id / hotel.name", () => {
    expect(validateHospitalityContent({ hotel: {} }).valid).toBe(false)
    expect(validateHospitalityContent({}).valid).toBe(false)
  })

  it("rejects malformed room types (missing name)", () => {
    expect(
      validateHospitalityContent({
        hotel: { id: "hrmt_abc", name: "X" },
        room_types: [{ id: "hrmt_std" }],
      }).valid,
    ).toBe(false)
  })

  it("clamps star_rating to 0..5", () => {
    expect(
      validateHospitalityContent({
        hotel: { id: "hrmt_abc", name: "X", star_rating: 6 },
      }).valid,
    ).toBe(false)
  })

  it("rejects bad meal_plans (missing basis)", () => {
    expect(
      validateHospitalityContent({
        hotel: { id: "hrmt_abc", name: "X" },
        meal_plans: [{ id: "mp_bb", name: "B&B" }],
      }).valid,
    ).toBe(false)
  })
})

describe("mergeOverlaysIntoHospitalityContent", () => {
  it("applies a top-level hotel field overlay", () => {
    const merged = mergeOverlaysIntoHospitalityContent(baseContent, [
      { field_path: "/hotel/name", value: "Hotel Probă" },
    ])
    expect(merged.hotel.name).toBe("Hotel Probă")
  })

  it("applies a deep room-types overlay", () => {
    const merged = mergeOverlaysIntoHospitalityContent(baseContent, [
      { field_path: "/room_types/1/description", value: "Apartament de lux" },
    ])
    expect(merged.room_types[1]?.description).toBe("Apartament de lux")
  })

  it("rolls back overlays that produce an invalid payload", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoHospitalityContent(
      baseContent,
      [{ field_path: "/hotel/name", value: 42 }],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.hotel.name).toBe("Hotel Sample")
    expect(errors).toHaveLength(1)
  })

  it("does not mutate the input payload", () => {
    const before = JSON.parse(JSON.stringify(baseContent))
    mergeOverlaysIntoHospitalityContent(baseContent, [
      { field_path: "/hotel/description", value: "X" },
    ])
    expect(baseContent).toEqual(before)
  })
})
