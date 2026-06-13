/**
 * Unit tests for the projection extension.
 *
 * Pure tests — uses an in-memory `OfferDataSource` injected into the
 * extension via a stubbed `loadOriginalPrice` + a fixed `now()`. Verifies
 * the field outputs map cleanly from the evaluator's `EvaluationResult`
 * shape onto the catalog-document fields declared by
 * `productPromotionsCatalogPolicy`.
 *
 * Doesn't exercise the DB-backed `createDrizzleOfferDataSource` — that's
 * covered by the integration tests in tests/integration/.
 */

import type { IndexerSlice } from "@voyantjs/catalog"
import { describe, expect, it } from "vitest"

import {
  __test__,
  createProductPromotionsProjectionExtension,
} from "../../src/service-catalog-plane-promotions.js"

const { toProjectionMap, sliceAudience, EMPTY_PROJECTION } = __test__

const SLICE: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("toProjectionMap", () => {
  it("emits all-null fields with hasOffer=false when best is null", () => {
    const map = toProjectionMap(null, null, null)
    expect(map.get("hasOffer")).toBe(false)
    expect(map.get("bestOfferId")).toBeNull()
    expect(map.get("bestOfferName")).toBeNull()
    expect(map.get("bestOfferDiscountKind")).toBeNull()
    expect(map.get("bestOfferDiscountPercent")).toBeNull()
    expect(map.get("bestOfferDiscountAmountCents")).toBeNull()
    expect(map.get("originalPriceFromAmountCents")).toBeNull()
    expect(map.get("hasConditionalOffer")).toBe(false)
    expect(map.get("conditionalOfferId")).toBeNull()
    expect(map.get("conditionalOfferName")).toBeNull()
    expect(map.get("conditionalOfferDiscountKind")).toBeNull()
    expect(map.get("conditionalOfferDiscountPercent")).toBeNull()
    expect(map.get("conditionalOfferDiscountAmountCents")).toBeNull()
    expect(map.get("conditionalOfferMinPax")).toBeNull()
  })

  it("populates bestOffer fields + originalPrice when an offer applies", () => {
    const map = toProjectionMap(
      {
        offerId: "pofr_x",
        offerName: "Spring Sale",
        discountAppliedCents: 2000,
        discountedPriceCents: 8000,
        currency: "USD",
        discountKind: "percentage",
        discountPercent: 20,
        discountAmountCents: null,
        appliedCode: null,
        stackable: false,
      },
      null,
      10_000,
    )
    expect(map.get("hasOffer")).toBe(true)
    expect(map.get("bestOfferId")).toBe("pofr_x")
    expect(map.get("bestOfferName")).toBe("Spring Sale")
    expect(map.get("bestOfferDiscountKind")).toBe("percentage")
    expect(map.get("bestOfferDiscountPercent")).toBe(20)
    expect(map.get("bestOfferDiscountAmountCents")).toBeNull()
    expect(map.get("originalPriceFromAmountCents")).toBe(10_000)
  })

  it("populates bestOfferDiscountAmountCents for fixed_amount offers", () => {
    const map = toProjectionMap(
      {
        offerId: "pofr_y",
        offerName: "Five Off",
        discountAppliedCents: 500,
        discountedPriceCents: 9500,
        currency: "USD",
        discountKind: "fixed_amount",
        discountPercent: null,
        discountAmountCents: 500,
        appliedCode: null,
        stackable: false,
      },
      null,
      10_000,
    )
    expect(map.get("bestOfferDiscountKind")).toBe("fixed_amount")
    expect(map.get("bestOfferDiscountAmountCents")).toBe(500)
    expect(map.get("bestOfferDiscountPercent")).toBeNull()
  })

  it("populates conditionalOffer fields including minPax", () => {
    const map = toProjectionMap(
      null,
      {
        offerId: "pofr_cond",
        offerName: "Group Discount",
        discountKind: "percentage",
        discountPercent: 5,
        discountAmountCents: null,
        unmet: { kind: "min_pax", required: 4 },
      },
      null,
    )
    expect(map.get("hasConditionalOffer")).toBe(true)
    expect(map.get("conditionalOfferId")).toBe("pofr_cond")
    expect(map.get("conditionalOfferName")).toBe("Group Discount")
    expect(map.get("conditionalOfferDiscountKind")).toBe("percentage")
    expect(map.get("conditionalOfferDiscountPercent")).toBe(5)
    expect(map.get("conditionalOfferMinPax")).toBe(4)
  })

  it("can carry both best AND conditional simultaneously", () => {
    const map = toProjectionMap(
      {
        offerId: "pofr_a",
        offerName: "Auto",
        discountAppliedCents: 1000,
        discountedPriceCents: 9000,
        currency: "USD",
        discountKind: "percentage",
        discountPercent: 10,
        discountAmountCents: null,
        appliedCode: null,
        stackable: false,
      },
      {
        offerId: "pofr_b",
        offerName: "Group Bonus",
        discountKind: "percentage",
        discountPercent: 5,
        discountAmountCents: null,
        unmet: { kind: "min_pax", required: 4 },
      },
      10_000,
    )
    expect(map.get("hasOffer")).toBe(true)
    expect(map.get("hasConditionalOffer")).toBe(true)
    expect(map.get("bestOfferId")).toBe("pofr_a")
    expect(map.get("conditionalOfferId")).toBe("pofr_b")
  })
})

describe("sliceAudience", () => {
  it("maps staff-admin → staff", () => {
    expect(sliceAudience({ ...SLICE, audience: "staff-admin" })).toBe("staff")
  })

  it("passes Visibility values through unchanged", () => {
    expect(sliceAudience({ ...SLICE, audience: "staff" })).toBe("staff")
    expect(sliceAudience({ ...SLICE, audience: "customer" })).toBe("customer")
    expect(sliceAudience({ ...SLICE, audience: "partner" })).toBe("partner")
    expect(sliceAudience({ ...SLICE, audience: "supplier" })).toBe("supplier")
  })
})

describe("EMPTY_PROJECTION", () => {
  it("matches a fresh toProjectionMap(null, null, null)", () => {
    const fresh = toProjectionMap(null, null, null)
    for (const [key, value] of EMPTY_PROJECTION) {
      expect(fresh.get(key)).toEqual(value)
    }
  })
})

describe("createProductPromotionsProjectionExtension — short-circuit on no base price", () => {
  it("returns the empty projection when loadOriginalPrice yields amountCents=null", async () => {
    const extension = createProductPromotionsProjectionExtension({
      loadOriginalPrice: async () => ({ amountCents: null, currency: null }),
    })
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub — the extension short-circuits before touching db -- owner: promotions; existing suppression is intentional pending typed cleanup.
    const result = await extension.project({} as any, "prod_x", SLICE)
    expect(result.get("hasOffer")).toBe(false)
    expect(result.get("originalPriceFromAmountCents")).toBeNull()
  })

  it("returns the empty projection when loadOriginalPrice yields currency=null", async () => {
    const extension = createProductPromotionsProjectionExtension({
      loadOriginalPrice: async () => ({ amountCents: 10000, currency: null }),
    })
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub — the extension short-circuits before touching db -- owner: promotions; existing suppression is intentional pending typed cleanup.
    const result = await extension.project({} as any, "prod_x", SLICE)
    expect(result.get("hasOffer")).toBe(false)
  })
})
