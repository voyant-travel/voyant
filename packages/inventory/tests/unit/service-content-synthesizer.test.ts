import type { ProvenanceReadResult } from "@voyant-travel/catalog"
import { describe, expect, it } from "vitest"

import { PRODUCTS_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { synthesizeProductContent } from "../../src/service-content-synthesizer.js"

function makeProvenance(
  projection: Record<string, unknown> = {},
  overrides: Partial<Extract<ProvenanceReadResult, { kind: "sourced" }>> = {},
): Extract<ProvenanceReadResult, { kind: "sourced" }> {
  const now = new Date()
  return {
    kind: "sourced",
    provenance: {
      source_kind: "direct:tui",
      source_provider: "tui-uk",
      source_connection_id: "conn_tui_uk",
      source_ref: "TUI-PROD-1",
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

describe("synthesizeProductContent — typed empty states", () => {
  it("produces a minimal-but-valid payload from an almost-empty projection", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "prod_abc" }) },
    )

    expect(result.content_schema_version).toBe(PRODUCTS_CONTENT_SCHEMA_VERSION)
    expect(result.served_locale).toBe("en-GB")
    expect(result.content.product.id).toBe("prod_abc")
    expect(result.content.product.name).toBe("Unnamed product")
    // Empty arrays — typed empty states, never absent properties.
    expect(result.content.options).toEqual([])
    expect(result.content.days).toEqual([])
    expect(result.content.media).toEqual([])
    expect(result.content.policies).toEqual([])
  })

  it("uses projection.id when set, falls back to entry_id otherwise", () => {
    const withId = synthesizeProductContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "prod_abc", name: "Sample" }) },
    )
    expect(withId.content.product.id).toBe("prod_abc")

    const withoutId = synthesizeProductContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ name: "Sample" }) },
    )
    expect(withoutId.content.product.id).toBe("cse_test")
  })

  it("populates summary fields when the projection carries them", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "prod_abc",
          name: "Cluj City Tour",
          description: "5-day walking tour.",
          duration_days: 5,
          start_date: "2026-05-01",
          end_date: "2026-05-05",
          sell_currency: "EUR",
          country: "RO",
          tags: ["cultural", "walking"],
        }),
      },
    )
    expect(result.content.product.name).toBe("Cluj City Tour")
    expect(result.content.product.description).toBe("5-day walking tour.")
    expect(result.content.product.duration_days).toBe(5)
    expect(result.content.product.sell_currency).toBe("EUR")
    expect(result.content.product.country).toBe("RO")
    expect(result.content.product.tags).toEqual(["cultural", "walking"])
  })

  it("treats `title` as a fallback for `name`", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "prod_abc", title: "Title-only" }) },
    )
    expect(result.content.product.name).toBe("Title-only")
  })

  it("uses source_provider as supplier fallback", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance(
          { id: "prod_abc" },
          {
            provenance: {
              source_kind: "direct:tui",
              source_provider: "tui-de",
              source_connection_id: "conn_de",
              source_ref: "TUI-2",
              source_freshness: "sync",
            },
          },
        ),
      },
    )
    expect(result.content.product.supplier).toBe("tui-de")
  })

  it("includes a hero image when the projection carries hero_image_url", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "prod_abc",
          hero_image_url: "https://cdn/hero.jpg",
        }),
      },
    )
    expect(result.content.media).toEqual([
      { url: "https://cdn/hero.jpg", type: "image", caption: null, alt: null },
    ])
  })

  it("accepts an additional media[] array on the projection", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "prod_abc",
          media: [
            { url: "https://cdn/a.jpg", type: "image", caption: "A" },
            { url: "https://cdn/b.mp4", type: "video" },
          ],
        }),
      },
    )
    expect(result.content.media).toHaveLength(2)
    expect(result.content.media[1]?.type).toBe("video")
  })

  it("populates policies when projection carries cancellation/payment text", () => {
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      {
        provenance: makeProvenance({
          id: "prod_abc",
          cancellation_policy: "Free up to 30 days.",
          payment_terms: "20% deposit at booking.",
        }),
      },
    )
    expect(result.content.policies).toEqual([
      { kind: "cancellation", body: "Free up to 30 days." },
      { kind: "payment", body: "20% deposit at booking." },
    ])
  })

  it("applies overlays via JSON pointer at synthesis time", () => {
    const result = synthesizeProductContent(
      { locale: "ro-RO" },
      {
        provenance: makeProvenance({ id: "prod_abc", name: "Sample" }),
        overlays: [{ field_path: "/product/description", value: "Descriere în română" }],
      },
    )
    expect(result.content.product.description).toBe("Descriere în română")
  })

  it("never invents amenity-style fields the projection didn't declare", () => {
    // Synthesis is honest — empty arrays for options/days, no
    // hallucinated content. This is a structural invariant in §3.6.
    const result = synthesizeProductContent(
      { locale: "en-GB" },
      { provenance: makeProvenance({ id: "prod_abc", name: "Sample" }) },
    )
    expect(result.content.options).toEqual([])
    expect(result.content.days).toEqual([])
  })
})
