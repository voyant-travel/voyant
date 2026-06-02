import { describe, expect, it } from "vitest"

import {
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "./index.js"

describe("@voyantjs/products-contracts content shape", () => {
  it("validates the products/v1 rich content payload", () => {
    const content = productContentSchema.parse({
      product: { id: "prod_abc", name: "Sahara Desert Trek" },
      options: [{ id: "opt_std", name: "Standard Departure" }],
      days: [{ day_number: 1, title: "Arrival in Marrakech" }],
      policies: [{ kind: "cancellation", body: "Free cancellation up to 30 days." }],
    }) satisfies ProductContent

    expect(PRODUCTS_CONTENT_SCHEMA_VERSION).toBe("products/v1")
    expect(validateProductContent(content)).toMatchObject({ valid: true })
    expect(content.media).toEqual([])
    expect(content.components).toEqual([])
    expect(content.departures).toEqual([])
    expect(content.options[0]?.units).toEqual([])
    expect(content.product.sellable_kind).toBe("product")
  })

  it("validates package-style travel components", () => {
    const content = productContentSchema.parse({
      product: { id: "prod_pkg", name: "Coach and hotel package", sellable_kind: "package" },
      components: [
        {
          id: "cmp_stay",
          component_kind: "accommodation",
          title: "Hotel stay",
          binding: {
            type: "inline",
            content: {
              property: { name: "Sample Hotel", star_rating: 5 },
              room_type: { name: "Double room", max_occupancy: 2 },
              board_basis: "half_board",
              nights: 4,
            },
          },
        },
        {
          id: "cmp_transport",
          component_kind: "transport",
          title: "Coach transfer",
          binding: {
            type: "inline",
            content: {
              legs: [{ mode: "coach", from: { name: "City" }, to: { name: "Hotel" } }],
            },
          },
        },
      ],
    }) satisfies ProductContent

    expect(validateProductContent(content)).toMatchObject({ valid: true })
    expect(content.product.sellable_kind).toBe("package")
    expect(content.components).toHaveLength(2)
    expect(content.components[0]?.component_kind).toBe("accommodation")
  })

  it("defaults a media item type to image", () => {
    const content = productContentSchema.parse({
      product: { id: "prod_abc", name: "Sahara Desert Trek" },
      media: [{ url: "https://cdn.example.com/hero.jpg" }],
    }) satisfies ProductContent

    expect(content.media[0]?.type).toBe("image")
  })

  it("rejects payloads missing the required product summary", () => {
    expect(validateProductContent({ options: [] })).toMatchObject({ valid: false })
    expect(validateProductContent({ product: { name: "No id" } })).toMatchObject({ valid: false })
  })

  it("rejects unknown policy kinds", () => {
    expect(
      validateProductContent({
        product: { id: "prod_abc", name: "Sahara Desert Trek" },
        policies: [{ kind: "loyalty", body: "x" }],
      }),
    ).toMatchObject({ valid: false })
  })
})
