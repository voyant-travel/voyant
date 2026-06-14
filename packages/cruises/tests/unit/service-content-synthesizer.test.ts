import type { ProvenanceReadResult } from "@voyant-travel/catalog"
import { describe, expect, it } from "vitest"

import { CRUISES_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { synthesizeCruiseContent } from "../../src/service-content-synthesizer.js"

function makeProvenance(
  projection: Record<string, unknown> = {},
  overrides: Partial<Extract<ProvenanceReadResult, { kind: "sourced" }>> = {},
): Extract<ProvenanceReadResult, { kind: "sourced" }> {
  const now = new Date()
  return {
    kind: "sourced",
    provenance: {
      source_kind: "direct:viking",
      source_provider: "viking",
      source_connection_id: "conn_viking",
      source_ref: "VIKING-X1",
      source_freshness: "sync",
      last_sourced_at: now,
    },
    entry_id: "cse_test",
    status: "active",
    projection,
    projection_etag: null,
    projection_seen_at: now,
    first_seen_at: now,
    last_seen_at: now,
    ...overrides,
  }
}

describe("synthesizeCruiseContent — typed empty states", () => {
  it("produces a minimal-but-valid payload from an almost-empty projection", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "crus_abc" }) },
    )

    expect(result.content_schema_version).toBe(CRUISES_CONTENT_SCHEMA_VERSION)
    expect(result.served_locale).toBe("en-GB")
    expect(result.content.cruise.id).toBe("crus_abc")
    expect(result.content.cruise.name).toBe("Unnamed cruise")
    // Empty arrays — typed empty states.
    expect(result.content.sailings).toEqual([])
    expect(result.content.cabin_categories).toEqual([])
    expect(result.content.itinerary_stops).toEqual([])
    expect(result.content.policies).toEqual([])
    expect(result.content.ship).toBeNull()
  })

  it("populates ship when projection carries ship_name", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "crus_abc",
          name: "Greek Isles",
          ship_name: "MS Sample",
          ship_capacity: 1200,
        }),
      },
    )
    expect(result.content.ship?.name).toBe("MS Sample")
    expect(result.content.ship?.capacity).toBe(1200)
  })

  it("populates itinerary_stops from the projection's itinerary array", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "crus_abc",
          name: "Greek Isles",
          itinerary: [
            { day_number: 1, port_name: "Athens", date: "2026-06-01" },
            { day_number: 2, port_name: "Mykonos", description: "Day at port" },
            { day: 3, port: "Santorini" }, // alternate field shapes accepted
          ],
        }),
      },
    )
    expect(result.content.itinerary_stops).toHaveLength(3)
    expect(result.content.itinerary_stops[2]?.port_name).toBe("Santorini")
    expect(result.content.itinerary_stops[2]?.day_number).toBe(3)
  })

  it("skips itinerary entries missing port_name or day_number", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "crus_abc",
          name: "Greek Isles",
          itinerary: [
            { day_number: 1, port_name: "Athens" },
            { day_number: 0, port_name: "Bad" }, // dropped: bad day
            { day_number: 2 }, // dropped: no port
          ],
        }),
      },
    )
    expect(result.content.itinerary_stops).toHaveLength(1)
    expect(result.content.itinerary_stops[0]?.port_name).toBe("Athens")
  })

  it("uses source_provider as cruise_line fallback", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "crus_abc", name: "Greek Isles" }) },
    )
    expect(result.content.cruise.cruise_line).toBe("viking")
  })

  it("populates policies from cancellation_policy / payment_terms", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "crus_abc",
          name: "Greek Isles",
          cancellation_policy: "Free up to 60 days.",
          payment_terms: "30% deposit at booking.",
        }),
      },
    )
    expect(result.content.policies).toEqual([
      { kind: "cancellation", body: "Free up to 60 days." },
      { kind: "payment", body: "30% deposit at booking." },
    ])
  })

  it("never invents sailings / cabin_categories the projection didn't declare", () => {
    const result = synthesizeCruiseContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "crus_abc", name: "Greek Isles" }) },
    )
    expect(result.content.sailings).toEqual([])
    expect(result.content.cabin_categories).toEqual([])
  })

  it("applies overlays via JSON pointer at synthesis time", () => {
    const result = synthesizeCruiseContent(
      { locale: "ro-RO" },
      {
        provenance: makeProvenance({ id: "crus_abc", name: "Greek Isles" }),
        overlays: [{ field_path: "/cruise/description", value: "Descriere în română" }],
      },
    )
    expect(result.content.cruise.description).toBe("Descriere în română")
  })
})
