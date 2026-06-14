import { describe, expect, it } from "vitest"

import {
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "./index.js"

describe("@voyant-travel/products-contracts content shape", () => {
  it("validates the products/v1 rich content payload", () => {
    const content = productContentSchema.parse({
      product: { id: "prod_abc", name: "Sahara Desert Trek" },
      options: [{ id: "opt_std", name: "Standard Departure", board_basis: "half_board" }],
      days: [{ day_number: 1, title: "Arrival in Marrakech" }],
      policies: [{ kind: "cancellation", body: "Free cancellation up to 30 days." }],
    }) satisfies ProductContent

    expect(PRODUCTS_CONTENT_SCHEMA_VERSION).toBe("products/v1")
    expect(validateProductContent(content)).toMatchObject({ valid: true })
    expect(content.media).toEqual([])
    expect(content.departures).toEqual([])
    expect(content.options[0]?.units).toEqual([])
    expect(content.options[0]?.board_basis).toBe("half_board")
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

  it("rejects unknown option board basis values", () => {
    expect(
      validateProductContent({
        product: { id: "prod_abc", name: "Sahara Desert Trek" },
        options: [{ id: "opt_std", name: "Standard Departure", board_basis: "brunch_only" }],
      }),
    ).toMatchObject({ valid: false })
  })
})
