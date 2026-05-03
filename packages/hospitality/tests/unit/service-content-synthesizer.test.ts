import type { ProvenanceReadResult } from "@voyantjs/catalog"
import { describe, expect, it } from "vitest"

import { HOSPITALITY_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { synthesizeHospitalityContent } from "../../src/service-content-synthesizer.js"

function makeProvenance(
  projection: Record<string, unknown> = {},
  overrides: Partial<Extract<ProvenanceReadResult, { kind: "sourced" }>> = {},
): Extract<ProvenanceReadResult, { kind: "sourced" }> {
  const now = new Date()
  return {
    kind: "sourced",
    provenance: {
      source_kind: "bedbank:hotelbeds",
      source_provider: "Hotelbeds",
      source_connection_id: "conn_hb",
      source_ref: "HB-PROP-1",
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

describe("synthesizeHospitalityContent — typed empty states", () => {
  it("produces a minimal-but-valid payload from an almost-empty projection", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "hrmt_abc" }) },
    )
    expect(result.content_schema_version).toBe(HOSPITALITY_CONTENT_SCHEMA_VERSION)
    expect(result.served_locale).toBe("en-GB")
    expect(result.content.hotel.id).toBe("hrmt_abc")
    expect(result.content.hotel.name).toBe("Unnamed property")
    expect(result.content.room_types).toEqual([])
    expect(result.content.rate_plans).toEqual([])
    expect(result.content.meal_plans).toEqual([])
    expect(result.content.amenities).toEqual([])
    expect(result.content.policies).toEqual([])
  })

  it("populates hotel summary from the projection", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "hrmt_abc",
          name: "Sample Hotel",
          star_rating: 4,
          country: "RO",
          city: "Cluj-Napoca",
          latitude: 46.77,
          longitude: 23.6,
          check_in_time: "14:00",
          check_out_time: "12:00",
        }),
      },
    )
    expect(result.content.hotel.star_rating).toBe(4)
    expect(result.content.hotel.country).toBe("RO")
    expect(result.content.hotel.latitude).toBe(46.77)
    expect(result.content.hotel.check_in_time).toBe("14:00")
  })

  it("uses source_provider as brand fallback", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "hrmt_abc", name: "X" }) },
    )
    expect(result.content.hotel.brand).toBe("Hotelbeds")
  })

  it("normalizes a flat string-array of amenities into the structured shape", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "hrmt_abc",
          name: "X",
          amenities: ["Free Wi-Fi", "Outdoor Pool", "Spa"],
        }),
      },
    )
    expect(result.content.amenities).toHaveLength(3)
    expect(result.content.amenities[0]?.name).toBe("Free Wi-Fi")
    expect(result.content.amenities[0]?.id).toBe("free_wi_fi")
    // Category is null because the projection didn't tell us — we
    // never invent it.
    expect(result.content.amenities[0]?.category).toBeNull()
  })

  it("accepts amenity objects with id / category / description", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "hrmt_abc",
          name: "X",
          amenities: [{ id: "wifi", name: "Wi-Fi", category: "connectivity", is_free: true }],
        }),
      },
    )
    expect(result.content.amenities[0]?.id).toBe("wifi")
    expect(result.content.amenities[0]?.category).toBe("connectivity")
    expect(result.content.amenities[0]?.is_free).toBe(true)
  })

  it("never invents room_types / rate_plans the projection didn't declare", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "hrmt_abc", name: "X" }) },
    )
    expect(result.content.room_types).toEqual([])
    expect(result.content.rate_plans).toEqual([])
    expect(result.content.meal_plans).toEqual([])
  })

  it("populates check-in policy from the projection", () => {
    const result = synthesizeHospitalityContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "hrmt_abc",
          name: "X",
          check_in_policy: "Photo ID required at reception.",
        }),
      },
    )
    expect(result.content.policies[0]?.kind).toBe("check_in")
  })

  it("applies overlays via JSON pointer at synthesis time", () => {
    const result = synthesizeHospitalityContent(
      { locale: "ro-RO" },
      {
        provenance: makeProvenance({ id: "hrmt_abc", name: "Sample Hotel" }),
        overlays: [{ field_path: "/hotel/description", value: "Descriere în română" }],
      },
    )
    expect(result.content.hotel.description).toBe("Descriere în română")
  })
})
