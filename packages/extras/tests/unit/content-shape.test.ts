import { describe, expect, it } from "vitest"

import {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  extraContentSchema,
  mergeOverlaysIntoExtraContent,
  validateExtraContent,
} from "../../src/content-shape.js"

const baseContent: ExtraContent = extraContentSchema.parse({
  extra: {
    id: "pxtr_abc",
    name: "Half-day City Tour",
    selection_type: "optional",
    pricing_mode: "per_person",
    priced_per_person: true,
    category: "excursion",
    duration_minutes: 240,
  },
  options: [
    { id: "opt_morning", name: "Morning slot", default_selected: true },
    { id: "opt_afternoon", name: "Afternoon slot" },
  ],
  media: [{ url: "https://cdn/tour.jpg", type: "image", caption: "Tour highlight" }],
  policies: [{ kind: "cancellation", body: "Free up to 24h." }],
})

describe("EXTRAS_CONTENT_SCHEMA_VERSION", () => {
  it("is the extras/v1 stable identifier", () => {
    expect(EXTRAS_CONTENT_SCHEMA_VERSION).toBe("extras/v1")
  })
})

describe("validateExtraContent", () => {
  it("accepts a minimal valid payload (only required extra.{id,name})", () => {
    expect(validateExtraContent({ extra: { id: "pxtr_abc", name: "X" } }).valid).toBe(true)
  })

  it("accepts a full valid payload", () => {
    expect(validateExtraContent(baseContent).valid).toBe(true)
  })

  it("rejects missing extra.id / extra.name", () => {
    expect(validateExtraContent({ extra: {} }).valid).toBe(false)
    expect(validateExtraContent({}).valid).toBe(false)
  })

  it("rejects malformed media items (missing url)", () => {
    expect(
      validateExtraContent({
        extra: { id: "pxtr_abc", name: "X" },
        media: [{ type: "image", caption: "no url" }],
      }).valid,
    ).toBe(false)
  })

  it("returns a descriptive reason for validation failures", () => {
    const result = validateExtraContent({ extra: { id: "pxtr_abc" } })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toMatch(/name/i)
    }
  })
})

describe("mergeOverlaysIntoExtraContent", () => {
  it("applies a top-level extra field overlay", () => {
    const merged = mergeOverlaysIntoExtraContent(baseContent, [
      { field_path: "/extra/name", value: "Tur jumătate de zi" },
    ])
    expect(merged.extra.name).toBe("Tur jumătate de zi")
  })

  it("applies a deep options field overlay", () => {
    const merged = mergeOverlaysIntoExtraContent(baseContent, [
      { field_path: "/options/0/description", value: "Slot dimineață" },
    ])
    expect(merged.options[0]?.description).toBe("Slot dimineață")
  })

  it("rolls back overlays that produce an invalid payload", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoExtraContent(
      baseContent,
      [{ field_path: "/extra/name", value: 42 }],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.extra.name).toBe("Half-day City Tour")
    expect(errors).toHaveLength(1)
  })

  it("does not mutate the input payload", () => {
    const before = JSON.parse(JSON.stringify(baseContent))
    mergeOverlaysIntoExtraContent(baseContent, [{ field_path: "/extra/description", value: "X" }])
    expect(baseContent).toEqual(before)
  })
})
