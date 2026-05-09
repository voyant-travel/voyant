/**
 * Unit tests for the storefront resolver mapping helpers.
 *
 * Pure tests against the `__test__` exports — verifies the
 * `PromotionalOffer` → `StorefrontPromotionalOffer` shape mapping and
 * the per-scope-kind `matchesProduct` predicate.
 */

import { describe, expect, it } from "vitest"

import type { PromotionalOffer } from "../../src/schema.js"
import { __test__ } from "../../src/service-storefront.js"
import type { PromotionalOfferScope } from "../../src/validation.js"

const { matchesProduct, toStorefrontDto } = __test__

let seq = 0
function makeOffer(overrides: Partial<PromotionalOffer> = {}): PromotionalOffer {
  seq += 1
  return {
    id: overrides.id ?? `pofr_${seq.toString().padStart(6, "0")}`,
    name: `Offer ${seq}`,
    slug: `offer-${seq}`,
    description: null,
    discountType: "percentage",
    discountPercent: "20",
    discountAmountCents: null,
    currency: null,
    scope: { kind: "global" } satisfies PromotionalOfferScope,
    conditions: {},
    validFrom: null,
    validUntil: null,
    code: null,
    stackable: false,
    active: true,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  }
}

describe("matchesProduct", () => {
  it("global always matches", () => {
    expect(matchesProduct({ kind: "global" }, false)).toBe(true)
    expect(matchesProduct({ kind: "global" }, true)).toBe(true)
  })

  it("products / categories / destinations defer to the link table predicate", () => {
    for (const scope of [
      { kind: "products", productIds: ["p1"] },
      { kind: "categories", categoryIds: ["c1"] },
      { kind: "destinations", destinationIds: ["d1"] },
    ] satisfies PromotionalOfferScope[]) {
      expect(matchesProduct(scope, true)).toBe(true)
      expect(matchesProduct(scope, false)).toBe(false)
    }
  })

  it("markets / audiences scopes don't render in the storefront listing in v1", () => {
    expect(matchesProduct({ kind: "markets", marketIds: ["mkt_uk"] }, true)).toBe(false)
    expect(matchesProduct({ kind: "audiences", audiences: ["customer"] }, true)).toBe(false)
  })
})

describe("toStorefrontDto", () => {
  it("maps a percentage offer with discountValue formatted as the percent string", () => {
    const offer = makeOffer({ discountType: "percentage", discountPercent: "20" })
    const dto = toStorefrontDto(offer, ["prod_a", "prod_b"])
    expect(dto.discountType).toBe("percentage")
    expect(dto.discountValue).toBe("20")
    expect(dto.applicableProductIds).toEqual(["prod_a", "prod_b"])
    expect(dto.applicableDepartureIds).toEqual([])
    expect(dto.imageMobileUrl).toBeNull()
    expect(dto.imageDesktopUrl).toBeNull()
  })

  it("maps a fixed_amount offer with discountValue as the cents amount string", () => {
    const offer = makeOffer({
      discountType: "fixed_amount",
      discountPercent: null,
      discountAmountCents: 500,
      currency: "USD",
    })
    const dto = toStorefrontDto(offer, [])
    expect(dto.discountType).toBe("fixed_amount")
    expect(dto.discountValue).toBe("500")
    expect(dto.currency).toBe("USD")
  })

  it("populates minTravelers from conditions.minPax (or null when absent)", () => {
    const withCondition = makeOffer({ conditions: { minPax: 4 } })
    const withoutCondition = makeOffer({ conditions: {} })
    expect(toStorefrontDto(withCondition, []).minTravelers).toBe(4)
    expect(toStorefrontDto(withoutCondition, []).minTravelers).toBeNull()
  })

  it("formats validFrom / validTo as ISO strings (or null)", () => {
    const dto = toStorefrontDto(
      makeOffer({
        validFrom: new Date("2026-05-01T00:00:00Z"),
        validUntil: new Date("2026-06-01T00:00:00Z"),
      }),
      [],
    )
    expect(dto.validFrom).toBe("2026-05-01T00:00:00.000Z")
    expect(dto.validTo).toBe("2026-06-01T00:00:00.000Z")
    const noWindow = toStorefrontDto(makeOffer(), [])
    expect(noWindow.validFrom).toBeNull()
    expect(noWindow.validTo).toBeNull()
  })

  it("propagates stackable flag and timestamps", () => {
    const dto = toStorefrontDto(makeOffer({ stackable: true }), [])
    expect(dto.stackable).toBe(true)
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(dto.updatedAt).toBe("2026-01-15T00:00:00.000Z")
  })
})
