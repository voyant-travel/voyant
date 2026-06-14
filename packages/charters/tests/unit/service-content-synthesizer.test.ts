import type { ProvenanceReadResult } from "@voyant-travel/catalog"
import { describe, expect, it } from "vitest"

import { CHARTERS_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { synthesizeCharterContent } from "../../src/service-content-synthesizer.js"

function makeProvenance(
  projection: Record<string, unknown> = {},
  overrides: Partial<Extract<ProvenanceReadResult, { kind: "sourced" }>> = {},
): Extract<ProvenanceReadResult, { kind: "sourced" }> {
  const now = new Date()
  return {
    kind: "sourced",
    provenance: {
      source_kind: "direct:myba",
      source_provider: "MYBA",
      source_connection_id: "conn_myba",
      source_ref: "MYBA-CHARTER-1",
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

describe("synthesizeCharterContent — typed empty states", () => {
  it("produces a minimal-but-valid payload from an almost-empty projection", () => {
    const result = synthesizeCharterContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "chrt_abc" }) },
    )
    expect(result.content_schema_version).toBe(CHARTERS_CONTENT_SCHEMA_VERSION)
    expect(result.served_locale).toBe("en-GB")
    expect(result.content.charter.id).toBe("chrt_abc")
    expect(result.content.charter.name).toBe("Unnamed charter")
    expect(result.content.voyages).toEqual([])
    expect(result.content.suites).toEqual([])
    expect(result.content.schedule_days).toEqual([])
    expect(result.content.policies).toEqual([])
    expect(result.content.yacht).toBeNull()
  })

  it("populates yacht when projection carries yacht_name + spec", () => {
    const result = synthesizeCharterContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "chrt_abc",
          name: "Med Charter",
          yacht_name: "Sample Yacht",
          length_meters: 50,
          capacity_guests: 12,
          capacity_crew: 9,
          year_built: 2020,
          builder: "Sample Builder",
        }),
      },
    )
    expect(result.content.yacht?.name).toBe("Sample Yacht")
    expect(result.content.yacht?.length_meters).toBe(50)
    expect(result.content.yacht?.capacity_guests).toBe(12)
    expect(result.content.yacht?.capacity_crew).toBe(9)
    expect(result.content.yacht?.year_built).toBe(2020)
  })

  it("populates summary fields when projection carries them", () => {
    const result = synthesizeCharterContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "chrt_abc",
          name: "Med Charter",
          charter_type: "whole_yacht",
          cruising_area: "Western Med",
          base_port: "Antibes",
          duration_nights: 7,
        }),
      },
    )
    expect(result.content.charter.charter_type).toBe("whole_yacht")
    expect(result.content.charter.cruising_area).toBe("Western Med")
    expect(result.content.charter.base_port).toBe("Antibes")
    expect(result.content.charter.duration_nights).toBe(7)
  })

  it("populates APA policy when projection carries apa_terms", () => {
    const result = synthesizeCharterContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "chrt_abc",
          name: "Med Charter",
          apa_terms: "30% APA payable in advance.",
          cancellation_policy: "Free up to 90 days.",
        }),
      },
    )
    const kinds = result.content.policies.map((p) => p.kind)
    expect(kinds).toContain("apa")
    expect(kinds).toContain("cancellation")
  })

  it("never invents voyages / suites the projection didn't declare", () => {
    const result = synthesizeCharterContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "chrt_abc", name: "Med Charter" }) },
    )
    expect(result.content.voyages).toEqual([])
    expect(result.content.suites).toEqual([])
  })

  it("applies overlays via JSON pointer at synthesis time", () => {
    const result = synthesizeCharterContent(
      { locale: "ro-RO" },
      {
        provenance: makeProvenance({ id: "chrt_abc", name: "Med Charter" }),
        overlays: [{ field_path: "/charter/description", value: "Descriere în română" }],
      },
    )
    expect(result.content.charter.description).toBe("Descriere în română")
  })
})
