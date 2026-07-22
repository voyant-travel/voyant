import { describe, expect, it } from "vitest"

import { type ContentOverlay, mergeOverlaysIntoContent } from "./content.js"

describe("mergeOverlaysIntoContent", () => {
  it("allows overlay-only fields when the source omitted the value", () => {
    const result = mergeOverlaysIntoContent({ product: { id: "prod_1", name: "Source" } }, [
      { field_path: "/product/seoTitle", value: "Romanian SEO title" },
    ])

    expect(result).toEqual({
      product: { id: "prod_1", name: "Source", seoTitle: "Romanian SEO title" },
    })
  })

  it("resolves nested overlays by stable node key instead of array position", () => {
    const content = {
      days: [
        { id: "day_b", title: "Day B" },
        { id: "day_a", title: "Day A" },
      ],
    }
    const overlays: ContentOverlay[] = [
      {
        node_kind: "itinerary-day",
        node_key: "day_a",
        field_path: "title",
        value: "Localized Day A",
      },
    ]

    const result = mergeOverlaysIntoContent(content, overlays, {
      resolveNodePointer(payload, overlay) {
        const days = (payload as { days: Array<{ id: string }> }).days
        const index = days.findIndex((day) => day.id === overlay.node_key)
        return index < 0 ? null : `/days/${index}/${overlay.field_path}`
      },
    })

    expect(result).toEqual({
      days: [
        { id: "day_b", title: "Day B" },
        { id: "day_a", title: "Localized Day A" },
      ],
    })
  })

  it("skips orphaned node overlays instead of retargeting another item", () => {
    const errors: string[] = []
    const result = mergeOverlaysIntoContent(
      { days: [{ id: "day_b", title: "Day B" }] },
      [
        {
          node_kind: "itinerary-day",
          node_key: "day_a",
          field_path: "title",
          value: "Localized Day A",
        },
      ],
      {
        resolveNodePointer: () => null,
        onOverlayError(event) {
          errors.push(event.reason)
        },
      },
    )

    expect(result).toEqual({ days: [{ id: "day_b", title: "Day B" }] })
    expect(errors[0]).toMatch(/not present/)
  })
})
