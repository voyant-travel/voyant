import type { ProvenanceReadResult } from "@voyantjs/catalog"
import { describe, expect, it } from "vitest"

import { EXTRAS_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { synthesizeExtraContent } from "../../src/service-content-synthesizer.js"

function makeProvenance(
  projection: Record<string, unknown> = {},
  overrides: Partial<Extract<ProvenanceReadResult, { kind: "sourced" }>> = {},
): Extract<ProvenanceReadResult, { kind: "sourced" }> {
  const now = new Date()
  return {
    kind: "sourced",
    provenance: {
      source_kind: "direct:tui",
      source_provider: "TUI Excursions",
      source_connection_id: "conn_tui",
      source_ref: "TUI-EXC-1",
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

describe("synthesizeExtraContent — typed empty states", () => {
  it("produces a minimal-but-valid payload from an almost-empty projection", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "pxtr_abc" }) },
    )
    expect(result.content_schema_version).toBe(EXTRAS_CONTENT_SCHEMA_VERSION)
    expect(result.served_locale).toBe("en-GB")
    expect(result.content.extra.id).toBe("pxtr_abc")
    expect(result.content.extra.name).toBe("Unnamed extra")
    // Defaults for selection / pricing reflect the most common case.
    expect(result.content.extra.selection_type).toBe("optional")
    expect(result.content.extra.pricing_mode).toBe("per_booking")
    expect(result.content.options).toEqual([])
    expect(result.content.media).toEqual([])
    expect(result.content.policies).toEqual([])
  })

  it("populates summary fields when the projection carries them", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "pxtr_abc",
          name: "Half-day Tour",
          selection_type: "optional",
          pricing_mode: "per_person",
          priced_per_person: true,
          category: "excursion",
          duration_minutes: 240,
          requirements_summary: "Comfortable shoes",
        }),
      },
    )
    expect(result.content.extra.pricing_mode).toBe("per_person")
    expect(result.content.extra.priced_per_person).toBe(true)
    expect(result.content.extra.category).toBe("excursion")
    expect(result.content.extra.duration_minutes).toBe(240)
    expect(result.content.extra.requirements_summary).toBe("Comfortable shoes")
  })

  it("uses source_provider as supplier fallback", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "pxtr_abc", name: "X" }) },
    )
    expect(result.content.extra.supplier).toBe("TUI Excursions")
  })

  it("includes a hero image when projection carries hero_image_url", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "pxtr_abc",
          name: "X",
          hero_image_url: "https://cdn/extra.jpg",
        }),
      },
    )
    expect(result.content.media).toEqual([
      { url: "https://cdn/extra.jpg", type: "image", caption: null, alt: null },
    ])
  })

  it("populates policies from cancellation_policy / payment_terms / requirements", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "pxtr_abc",
          name: "X",
          cancellation_policy: "Free up to 24h.",
          payment_terms: "Pay at booking.",
          requirements: "Photo ID required.",
        }),
      },
    )
    const kinds = result.content.policies.map((p) => p.kind)
    expect(kinds).toContain("cancellation")
    expect(kinds).toContain("payment")
    expect(kinds).toContain("requirements")
  })

  it("never invents options the projection didn't declare", () => {
    const result = synthesizeExtraContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "pxtr_abc", name: "X" }) },
    )
    expect(result.content.options).toEqual([])
  })

  it("applies overlays via JSON pointer at synthesis time", () => {
    const result = synthesizeExtraContent(
      { locale: "ro-RO" },
      {
        provenance: makeProvenance({ id: "pxtr_abc", name: "Tour" }),
        overlays: [{ field_path: "/extra/description", value: "Descriere în română" }],
      },
    )
    expect(result.content.extra.description).toBe("Descriere în română")
  })
})
