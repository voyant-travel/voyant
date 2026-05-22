import { describe, expect, it } from "vitest"

import {
  mergeOverlaysIntoProductContent,
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "../../src/content-shape.js"

const baseContent: ProductContent = productContentSchema.parse({
  product: {
    id: "prod_abc",
    name: "Sample tour",
    description: "A pleasant trip.",
    duration_days: 5,
  },
  options: [],
  days: [
    { day_number: 1, title: "Arrival", description: "Welcome day" },
    { day_number: 2, title: "Sightseeing", description: "Old town walking tour" },
  ],
  media: [{ url: "https://cdn/example.jpg", type: "image", caption: "Hero", alt: "Hero image" }],
  policies: [{ kind: "cancellation", body: "Free up to 30 days." }],
})

describe("PRODUCTS_CONTENT_SCHEMA_VERSION", () => {
  it("is a stable string used to gate cache reads", () => {
    expect(PRODUCTS_CONTENT_SCHEMA_VERSION).toBe("products/v1")
  })
})

describe("validateProductContent", () => {
  it("accepts a minimal valid payload (only required product.{id,name})", () => {
    const result = validateProductContent({
      product: { id: "prod_abc", name: "X" },
      options: [],
      days: [],
      media: [],
      policies: [],
    })
    expect(result.valid).toBe(true)
  })

  it("accepts product contract template ids in public and content payloads", () => {
    const parsed = productContentSchema.parse({
      product: {
        id: "prod_abc",
        name: "X",
        contract_template_id: "ctpl_customer_terms",
        contractTemplateId: "ctpl_customer_terms",
      },
    })

    expect(parsed.product.contract_template_id).toBe("ctpl_customer_terms")
    expect(parsed.product.contractTemplateId).toBe("ctpl_customer_terms")
  })

  it("accepts a full valid payload", () => {
    const result = validateProductContent(baseContent)
    expect(result.valid).toBe(true)
  })

  it("fills array defaults", () => {
    const parsed = productContentSchema.parse({
      product: { id: "prod_abc", name: "X" },
    })
    expect(parsed.options).toEqual([])
    expect(parsed.days).toEqual([])
    expect(parsed.media).toEqual([])
    expect(parsed.policies).toEqual([])
  })

  it("rejects missing product.id / product.name", () => {
    expect(validateProductContent({ product: {} }).valid).toBe(false)
    expect(validateProductContent({}).valid).toBe(false)
  })

  it("rejects malformed media items (missing url)", () => {
    const result = validateProductContent({
      product: { id: "prod_abc", name: "X" },
      media: [{ type: "image", caption: "no url" }],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects bad day_number values", () => {
    const result = validateProductContent({
      product: { id: "prod_abc", name: "X" },
      days: [{ day_number: 0 }],
    })
    expect(result.valid).toBe(false)
  })

  it("returns a descriptive reason for validation failures", () => {
    const result = validateProductContent({ product: { id: "prod_abc" } })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toMatch(/name/i)
    }
  })
})

describe("mergeOverlaysIntoProductContent", () => {
  it("applies a top-level product field overlay", () => {
    const merged = mergeOverlaysIntoProductContent(baseContent, [
      { field_path: "/product/name", value: "Romanian translation" },
    ])
    expect(merged.product.name).toBe("Romanian translation")
  })

  it("applies a deep day field overlay", () => {
    const merged = mergeOverlaysIntoProductContent(baseContent, [
      { field_path: "/days/1/description", value: "Tur la pas în orașul vechi" },
    ])
    expect(merged.days[1]?.description).toBe("Tur la pas în orașul vechi")
  })

  it("rolls back overlays that produce an invalid payload", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoProductContent(
      baseContent,
      [{ field_path: "/product/name", value: 42 }],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.product.name).toBe("Sample tour") // rolled back
    expect(errors).toHaveLength(1)
    expect(errors[0]?.field_path).toBe("/product/name")
  })

  it("returns a new payload — input is not mutated", () => {
    const before = JSON.parse(JSON.stringify(baseContent))
    mergeOverlaysIntoProductContent(baseContent, [
      { field_path: "/product/name", value: "Another name" },
    ])
    expect(baseContent).toEqual(before)
  })

  it("applies multiple overlays in input order", () => {
    const merged = mergeOverlaysIntoProductContent(baseContent, [
      { field_path: "/product/description", value: "step 1" },
      { field_path: "/product/description", value: "step 2" },
    ])
    expect(merged.product.description).toBe("step 2")
  })

  it("ignores invalid pointers, calling onOverlayError once each", () => {
    const errors: Array<{ field_path: string; reason: string }> = []
    const merged = mergeOverlaysIntoProductContent(
      baseContent,
      [
        { field_path: "/product/name", value: "Romanian" },
        { field_path: "/missing/deep/path", value: "X" },
      ],
      {
        onOverlayError: (e) => errors.push({ field_path: e.overlay.field_path, reason: e.reason }),
      },
    )
    expect(merged.product.name).toBe("Romanian")
    expect(errors).toHaveLength(1)
    expect(errors[0]?.field_path).toBe("/missing/deep/path")
  })
})
