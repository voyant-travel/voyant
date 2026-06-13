import type { IndexerSlice } from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"

import {
  __test__,
  createProductPricingProjectionExtension,
} from "../src/service-catalog-plane-pricing.js"

const {
  aggregatePricing,
  EMPTY_AGGREGATE,
  firstPositiveMin,
  isMissingCatalogPricingDependencyError,
} = __test__

const customerSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("aggregatePricing (kernel)", () => {
  it("returns empty aggregate when product has null price and no rules", () => {
    expect(aggregatePricing(null, "USD", [], [])).toEqual({
      ...EMPTY_AGGREGATE,
      priceFromCurrency: "USD",
    })
  })

  it("returns the product price when there are no rule candidates", () => {
    const out = aggregatePricing(15000, "USD", [], [])
    expect(out.priceFromAmountCents).toBe(15000)
    expect(out.priceFromCurrency).toBe("USD")
    expect(out.hasPricing).toBe(true)
  })

  it("returns MIN of room candidates when product price is null", () => {
    const out = aggregatePricing(null, "USD", [9900, 14900, 19900], [])
    expect(out.priceFromAmountCents).toBe(9900)
    expect(out.hasPricing).toBe(true)
  })

  it("prefers room prices over stale row-level pricing", () => {
    const out = aggregatePricing(5000, "USD", [9900, 14900], [])
    expect(out.priceFromAmountCents).toBe(9900)
  })

  it("falls back to base prices when no room prices exist", () => {
    const out = aggregatePricing(1000, "USD", [], [4900, 9900])
    expect(out.priceFromAmountCents).toBe(4900)
  })

  it("handles a mix of base and unit-rule fallback candidates", () => {
    const out = aggregatePricing(null, "EUR", [], [12000, 8500, 14000])
    expect(out.priceFromAmountCents).toBe(8500)
  })

  it("treats zero as missing instead of a real price", () => {
    const out = aggregatePricing(0, "EUR", [0], [])
    expect(out.hasPricing).toBe(false)
    expect(out.priceFromAmountCents).toBeNull()
  })

  it("hasPricing=false when nothing is priced (currency still surfaced)", () => {
    const out = aggregatePricing(null, "USD", [], [])
    expect(out.hasPricing).toBe(false)
    expect(out.priceFromAmountCents).toBeNull()
    // Keep the currency so storefront can format empty states with the
    // operator's default symbol.
    expect(out.priceFromCurrency).toBe("USD")
  })

  it("preserves currency=null when product currency is missing", () => {
    const out = aggregatePricing(null, null, [], [])
    expect(out.priceFromCurrency).toBeNull()
    expect(out.hasPricing).toBe(false)
  })

  it("finds the first positive minimum", () => {
    expect(firstPositiveMin([0, -1, 12000, 8000])).toBe(8000)
    expect(firstPositiveMin([0, -1])).toBeNull()
  })

  it("classifies only expected missing schema errors as fixture gaps", () => {
    expect(isMissingCatalogPricingDependencyError({ code: "42P01" })).toBe(true)
    expect(isMissingCatalogPricingDependencyError({ code: "42703" })).toBe(true)
    expect(
      isMissingCatalogPricingDependencyError({
        message: 'relation "availability_slots" does not exist',
      }),
    ).toBe(true)
    expect(isMissingCatalogPricingDependencyError({ message: "no such table: option_units" })).toBe(
      true,
    )

    expect(isMissingCatalogPricingDependencyError({ code: "53300" })).toBe(false)
    expect(isMissingCatalogPricingDependencyError(new Error("connection terminated"))).toBe(false)
  })
})

describe("createProductPricingProjectionExtension", () => {
  it("short-circuits to row-only pricing when product has no currency", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 9900, sellCurrency: null }),
    })
    const out = await ext.project({} as AnyDrizzleDb, "prod_x", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(9900)
    expect(out.get("priceFromCurrency")).toBeNull()
    expect(out.get("hasPricing")).toBe(true)
  })

  it("returns empty + null currency when product is missing entirely", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: null, sellCurrency: null }),
    })
    const out = await ext.project({} as AnyDrizzleDb, "prod_missing", customerSlice)
    expect(out.get("hasPricing")).toBe(false)
    expect(out.get("priceFromAmountCents")).toBeNull()
  })

  it("prefers room rate-plan prices over row-level pricing", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 0, sellCurrency: "USD" }),
      loadRatePlanPricing: async () => ({ roomPrices: [16500], basePrices: [20000] }),
    })
    const out = await ext.project({} as AnyDrizzleDb, "prod_multi", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(16500)
    expect(out.get("priceFromCurrency")).toBe("USD")
    expect(out.get("hasPricing")).toBe(true)
  })

  it("falls back to positive product pricing when no rate-plan price exists", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 18000, sellCurrency: "USD" }),
      loadRatePlanPricing: async () => ({ roomPrices: [0], basePrices: [] }),
    })
    const out = await ext.project({} as AnyDrizzleDb, "prod_fallback", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(18000)
  })

  it("falls back to row pricing only for expected missing-schema query errors", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 18000, sellCurrency: "USD" }),
    })
    const db = {
      execute: async () => {
        throw Object.assign(new Error('relation "availability_slots" does not exist'), {
          code: "42P01",
        })
      },
    } as AnyDrizzleDb

    const out = await ext.project(db, "prod_fixture", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(18000)
  })

  it("propagates unexpected rate-plan query errors", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 18000, sellCurrency: "USD" }),
    })
    const db = {
      execute: async () => {
        throw Object.assign(new Error("connection terminated"), { code: "53300" })
      },
    } as AnyDrizzleDb

    await expect(ext.project(db, "prod_error", customerSlice)).rejects.toThrow(
      "connection terminated",
    )
  })
})
