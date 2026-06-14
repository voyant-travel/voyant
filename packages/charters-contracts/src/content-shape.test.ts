import { describe, expect, it } from "vitest"

import {
  CHARTERS_CONTENT_SCHEMA_VERSION,
  type CharterContent,
  charterContentSchema,
  validateCharterContent,
} from "./index.js"

describe("@voyant-travel/charters-contracts content shape", () => {
  it("validates the charters/v1 rich content payload", () => {
    const content = charterContentSchema.parse({
      charter: { id: "chrt_abc", name: "Aegean Escape", duration_nights: 7 },
      yacht: { name: "MY Serenity", type: "motor", capacity_guests: 12 },
      voyages: [{ id: "chvy_001", departure_date: "2026-06-01" }],
      schedule_days: [{ day_number: 1, port_or_anchorage: "Athens" }],
      policies: [{ kind: "apa", body: "APA is 30% of charter fee." }],
    }) satisfies CharterContent

    expect(CHARTERS_CONTENT_SCHEMA_VERSION).toBe("charters/v1")
    expect(validateCharterContent(content)).toMatchObject({ valid: true })
    expect(content.suites).toEqual([])
    expect(content.yacht?.amenities).toEqual([])
  })

  it("defaults schedule-day is_at_sea to false", () => {
    const content = charterContentSchema.parse({
      charter: { id: "chrt_abc", name: "Aegean Escape" },
      schedule_days: [{ day_number: 2 }],
    }) satisfies CharterContent

    expect(content.schedule_days[0]?.is_at_sea).toBe(false)
  })

  it("rejects payloads missing the required charter summary", () => {
    expect(validateCharterContent({ voyages: [] })).toMatchObject({ valid: false })
    expect(validateCharterContent({ charter: { id: "c" } })).toMatchObject({ valid: false })
  })

  it("rejects unknown policy kinds", () => {
    expect(
      validateCharterContent({
        charter: { id: "chrt_abc", name: "Aegean Escape" },
        policies: [{ kind: "loyalty", body: "x" }],
      }),
    ).toMatchObject({ valid: false })
  })
})
