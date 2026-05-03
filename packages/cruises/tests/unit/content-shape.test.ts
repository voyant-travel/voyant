import { describe, expect, it } from "vitest"

import {
  CRUISES_CONTENT_SCHEMA_VERSION,
  type CruiseContent,
  cruiseContentSchema,
  mergeOverlaysIntoCruiseContent,
  validateCruiseContent,
} from "../../src/content-shape.js"

const baseContent: CruiseContent = cruiseContentSchema.parse({
  cruise: {
    id: "crus_abc",
    name: "Greek Isles 7-night",
    duration_nights: 7,
    cruise_line: "Sample Line",
  },
  ship: { name: "MS Sample" },
  sailings: [
    {
      id: "sail_1",
      start_date: "2026-06-01",
      end_date: "2026-06-08",
      duration_nights: 7,
    },
  ],
  cabin_categories: [
    { id: "cab_inside", name: "Inside", type: "inside" },
    { id: "cab_balcony", name: "Balcony", type: "balcony" },
  ],
  itinerary_stops: [
    { day_number: 1, port_name: "Athens", date: "2026-06-01" },
    { day_number: 2, port_name: "Mykonos", date: "2026-06-02" },
  ],
  policies: [{ kind: "cancellation", body: "Free up to 60 days." }],
})

describe("CRUISES_CONTENT_SCHEMA_VERSION", () => {
  it("is the cruises/v1 stable identifier", () => {
    expect(CRUISES_CONTENT_SCHEMA_VERSION).toBe("cruises/v1")
  })
})

describe("validateCruiseContent", () => {
  it("accepts a minimal valid payload (only required cruise.{id,name})", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "crus_abc", name: "X" },
      }).valid,
    ).toBe(true)
  })

  it("accepts a full valid payload", () => {
    expect(validateCruiseContent(baseContent).valid).toBe(true)
  })

  it("rejects missing cruise.id / cruise.name", () => {
    expect(validateCruiseContent({ cruise: {} }).valid).toBe(false)
    expect(validateCruiseContent({}).valid).toBe(false)
  })

  it("rejects malformed sailings (missing start_date)", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "crus_abc", name: "X" },
        sailings: [{ id: "sail_1", end_date: "2026-06-08" }],
      }).valid,
    ).toBe(false)
  })

  it("rejects bad day_number on itinerary_stops", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "crus_abc", name: "X" },
        itinerary_stops: [{ day_number: 0, port_name: "Athens" }],
      }).valid,
    ).toBe(false)
  })

  it("ship is optional / nullable", () => {
    expect(
      validateCruiseContent({
        cruise: { id: "crus_abc", name: "X" },
        ship: null,
      }).valid,
    ).toBe(true)
  })
})

describe("mergeOverlaysIntoCruiseContent", () => {
  it("applies a top-level cruise field overlay", () => {
    const merged = mergeOverlaysIntoCruiseContent(baseContent, [
      { field_path: "/cruise/name", value: "Insulele Grecești 7-zile" },
    ])
    expect(merged.cruise.name).toBe("Insulele Grecești 7-zile")
  })

  it("applies a deep itinerary_stops overlay", () => {
    const merged = mergeOverlaysIntoCruiseContent(baseContent, [
      { field_path: "/itinerary_stops/1/description", value: "Vizita Mykonos" },
    ])
    expect(merged.itinerary_stops[1]?.description).toBe("Vizita Mykonos")
  })

  it("rolls back overlays that produce an invalid payload", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoCruiseContent(
      baseContent,
      [{ field_path: "/cruise/name", value: 42 }],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.cruise.name).toBe("Greek Isles 7-night")
    expect(errors).toHaveLength(1)
  })

  it("does not mutate the input payload", () => {
    const before = JSON.parse(JSON.stringify(baseContent))
    mergeOverlaysIntoCruiseContent(baseContent, [{ field_path: "/cruise/description", value: "X" }])
    expect(baseContent).toEqual(before)
  })
})
