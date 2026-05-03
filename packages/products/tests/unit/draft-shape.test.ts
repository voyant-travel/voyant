import { describe, expect, it } from "vitest"

import type { ProductContent } from "../../src/content-shape.js"
import { productContentSchema } from "../../src/content-shape.js"
import { buildProductDraftShape } from "../../src/draft-shape.js"

const minimalContent: ProductContent = productContentSchema.parse({
  product: { id: "prod_abc", name: "Sample Tour" },
})

const richContent: ProductContent = productContentSchema.parse({
  product: { id: "prod_abc", name: "Sample Tour" },
  options: [
    { id: "opt_a", name: "Premium upgrade" },
    { id: "opt_b", name: "Lunch included" },
  ],
})

describe("buildProductDraftShape", () => {
  it("renders configure + travelers + payment + review for a minimal product", () => {
    const shape = buildProductDraftShape(minimalContent)
    expect(shape.showsConfigure).toBe(true)
    expect(shape.showsTravelers).toBe(true)
    expect(shape.showsPayment).toBe(true)
    expect(shape.showsReview).toBe(true)
    expect(shape.showsAccommodation).toBe(false)
    // No options → no add-ons step.
    expect(shape.showsAddons).toBe(false)
    expect(shape.addons).toBeUndefined()
  })

  it("emits an occupancy sub-step under Configure", () => {
    const shape = buildProductDraftShape(minimalContent)
    expect(shape.configureSubSteps).toEqual([
      {
        kind: "occupancy",
        bands: [{ code: "adult", label: "Adult", minCount: 1, maxCount: 8 }],
      },
    ])
  })

  it("turns product options into addon offers when present", () => {
    const shape = buildProductDraftShape(richContent)
    expect(shape.showsAddons).toBe(true)
    expect(shape.addons?.catalog).toHaveLength(2)
    expect(shape.addons?.catalog?.[0]?.id).toBe("opt_a")
    expect(shape.addons?.catalog?.[0]?.kind).toBe("extras")
  })

  it("respects custom paxBands when provided", () => {
    const shape = buildProductDraftShape(minimalContent, {
      paxBands: [
        { code: "adult", label: "Adult", minCount: 1, maxCount: 4 },
        { code: "child", label: "Child", minCount: 0, maxCount: 2, minAge: 0, maxAge: 11 },
      ],
    })
    expect(shape.paxBands).toHaveLength(2)
    expect(shape.paxBandsAllowedTotal).toEqual({ min: 1, max: 6 })
  })

  it("respects an explicit paxBandsAllowedTotal override", () => {
    const shape = buildProductDraftShape(minimalContent, {
      paxBands: [{ code: "adult", label: "Adult", minCount: 1, maxCount: 8 }],
      paxBandsAllowedTotal: { min: 2, max: 6 }, // narrower than band sum
    })
    expect(shape.paxBandsAllowedTotal).toEqual({ min: 2, max: 6 })
  })

  it("declares hold + card payment intents", () => {
    const shape = buildProductDraftShape(minimalContent)
    expect(shape.paymentIntents).toEqual(["hold", "card"])
  })
})
