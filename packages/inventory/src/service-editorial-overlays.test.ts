import { describe, expect, it } from "vitest"

import {
  mergeOverlaysIntoProductContent,
  type ProductContent,
  validateProductContent,
} from "./content-shape.js"

const baseContent = {
  product: { id: "prod_1", name: "Source product" },
  options: [],
  days: [
    {
      id: "day_2",
      day_number: 2,
      title: "Second",
      description: "Source second",
      services: [],
    },
    {
      id: "day_1",
      day_number: 1,
      title: "First",
      description: "Source first",
      services: [],
    },
  ],
  media: [],
  policies: [],
  departures: [],
} satisfies ProductContent

describe("product editorial content overlays", () => {
  it("maps root product fields to the product content payload", () => {
    const merged = mergeOverlaysIntoProductContent(baseContent, [
      { field_path: "name", value: "Localized product" },
      { field_path: "/product/description", value: "Overlay-only translation" },
    ])

    expect(merged.product.name).toBe("Localized product")
    expect(merged.product.description).toBe("Overlay-only translation")
    expect(validateProductContent(merged)).toMatchObject({ valid: true })
  })

  it("applies itinerary-day overlays by stable day id after provider reordering", () => {
    const merged = mergeOverlaysIntoProductContent(baseContent, [
      {
        node_kind: "itinerary-day",
        node_key: "day_1",
        field_path: "description",
        value: "Localized first day",
      },
    ])

    expect(merged.days[0]?.description).toBe("Source second")
    expect(merged.days[1]?.description).toBe("Localized first day")
  })

  it("skips itinerary-day overlays when the provider did not supply a stable day id", () => {
    const errors: string[] = []
    const contentWithoutStableDay = {
      ...baseContent,
      days: [{ day_number: 1, title: "First", description: "Source first", services: [] }],
    } satisfies ProductContent

    const merged = mergeOverlaysIntoProductContent(
      contentWithoutStableDay,
      [
        {
          node_kind: "itinerary-day",
          node_key: "day_1",
          field_path: "description",
          value: "Localized first day",
        },
      ],
      {
        onOverlayError(event) {
          errors.push(event.reason)
        },
      },
    )

    expect(merged.days[0]?.description).toBe("Source first")
    expect(errors[0]).toMatch(/not present/)
  })
})
