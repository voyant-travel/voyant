import { describe, expect, it } from "vitest"

import {
  CHARTERS_CONTENT_SCHEMA_VERSION,
  type CharterContent,
  charterContentSchema,
  mergeOverlaysIntoCharterContent,
  validateCharterContent,
} from "../../src/content-shape.js"

const baseContent: CharterContent = charterContentSchema.parse({
  charter: {
    id: "chrt_abc",
    name: "Mediterranean 7-night",
    charter_type: "whole_yacht",
    cruising_area: "Western Med",
    duration_nights: 7,
  },
  yacht: {
    name: "Sample Yacht",
    type: "motor",
    length_meters: 50,
    capacity_guests: 12,
    capacity_crew: 9,
  },
  voyages: [
    {
      id: "voy_1",
      departure_date: "2026-06-01",
      return_date: "2026-06-08",
      duration_nights: 7,
    },
  ],
  suites: [
    { id: "stm_owner", name: "Owner's Suite", category: "owner" },
    { id: "stm_guest1", name: "Guest Suite 1", category: "guest" },
  ],
  schedule_days: [{ day_number: 1, port_or_anchorage: "Monaco", date: "2026-06-01" }],
  policies: [{ kind: "apa", body: "APA = 30% of charter fee." }],
})

describe("CHARTERS_CONTENT_SCHEMA_VERSION", () => {
  it("is the charters/v1 stable identifier", () => {
    expect(CHARTERS_CONTENT_SCHEMA_VERSION).toBe("charters/v1")
  })
})

describe("validateCharterContent", () => {
  it("accepts a minimal valid payload (only required charter.{id,name})", () => {
    expect(validateCharterContent({ charter: { id: "chrt_abc", name: "X" } }).valid).toBe(true)
  })

  it("accepts a full valid payload", () => {
    expect(validateCharterContent(baseContent).valid).toBe(true)
  })

  it("rejects missing charter.id / charter.name", () => {
    expect(validateCharterContent({ charter: {} }).valid).toBe(false)
    expect(validateCharterContent({}).valid).toBe(false)
  })

  it("rejects malformed voyages (missing departure_date)", () => {
    expect(
      validateCharterContent({
        charter: { id: "chrt_abc", name: "X" },
        voyages: [{ id: "voy_1" }],
      }).valid,
    ).toBe(false)
  })

  it("yacht is optional / nullable", () => {
    expect(
      validateCharterContent({ charter: { id: "chrt_abc", name: "X" }, yacht: null }).valid,
    ).toBe(true)
  })

  it("rejects bad day_number on schedule_days", () => {
    expect(
      validateCharterContent({
        charter: { id: "chrt_abc", name: "X" },
        schedule_days: [{ day_number: 0 }],
      }).valid,
    ).toBe(false)
  })
})

describe("mergeOverlaysIntoCharterContent", () => {
  it("applies a top-level charter field overlay", () => {
    const merged = mergeOverlaysIntoCharterContent(baseContent, [
      { field_path: "/charter/name", value: "Mediterana 7 nopți" },
    ])
    expect(merged.charter.name).toBe("Mediterana 7 nopți")
  })

  it("applies a deep yacht field overlay", () => {
    const merged = mergeOverlaysIntoCharterContent(baseContent, [
      { field_path: "/yacht/description", value: "Yacht de lux" },
    ])
    expect(merged.yacht?.description).toBe("Yacht de lux")
  })

  it("rolls back overlays that produce an invalid payload", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoCharterContent(
      baseContent,
      [{ field_path: "/charter/name", value: 42 }],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.charter.name).toBe("Mediterranean 7-night")
    expect(errors).toHaveLength(1)
  })

  it("does not mutate the input payload", () => {
    const before = JSON.parse(JSON.stringify(baseContent))
    mergeOverlaysIntoCharterContent(baseContent, [
      { field_path: "/charter/description", value: "X" },
    ])
    expect(baseContent).toEqual(before)
  })
})
