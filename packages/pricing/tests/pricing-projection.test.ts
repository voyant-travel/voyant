import type { AnyDrizzleDb } from "@voyantjs/db"
import type { IndexerSlice } from "@voyantjs/products/service-catalog-plane"
import { describe, expect, it } from "vitest"

import {
  __test__,
  createProductPricingProjectionExtension,
} from "../src/service-catalog-plane-pricing.js"

const { aggregatePricing, EMPTY_AGGREGATE } = __test__

const customerSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("aggregatePricing (kernel)", () => {
  it("returns empty aggregate when product has null price and no rules", () => {
    expect(aggregatePricing(null, "USD", [])).toEqual({
      ...EMPTY_AGGREGATE,
      priceFromCurrency: "USD",
    })
  })

  it("returns the product price when there are no rule candidates", () => {
    const out = aggregatePricing(15000, "USD", [])
    expect(out.priceFromAmountCents).toBe(15000)
    expect(out.priceFromCurrency).toBe("USD")
    expect(out.hasPricing).toBe(true)
  })

  it("returns MIN of rule candidates when product price is null", () => {
    const out = aggregatePricing(null, "USD", [9900, 14900, 19900])
    expect(out.priceFromAmountCents).toBe(9900)
    expect(out.hasPricing).toBe(true)
  })

  it("MINs the product price into the candidate set", () => {
    // Product has a default of 5000; one rule is cheaper at 4900.
    const out = aggregatePricing(5000, "USD", [4900, 9900])
    expect(out.priceFromAmountCents).toBe(4900)
  })

  it("product price wins when it's cheaper than every rule", () => {
    const out = aggregatePricing(1000, "USD", [4900, 9900])
    expect(out.priceFromAmountCents).toBe(1000)
  })

  it("handles a mix of unit-rule and flat-rule candidates", () => {
    // Per-unit prices feed in alongside flat rule prices — no special
    // handling needed in the kernel; both are just ints to MIN over.
    const out = aggregatePricing(
      null,
      "EUR",
      [/* flat */ 12000, /* unit single */ 8500, /* unit double */ 14000],
    )
    expect(out.priceFromAmountCents).toBe(8500)
  })

  it("hasPricing=false when nothing is priced (currency still surfaced)", () => {
    const out = aggregatePricing(null, "USD", [])
    expect(out.hasPricing).toBe(false)
    expect(out.priceFromAmountCents).toBeNull()
    // Keep the currency so storefront can format empty states with the
    // operator's default symbol.
    expect(out.priceFromCurrency).toBe("USD")
  })

  it("preserves currency=null when product currency is missing", () => {
    const out = aggregatePricing(null, null, [])
    expect(out.priceFromCurrency).toBeNull()
    expect(out.hasPricing).toBe(false)
  })
})

describe("createProductPricingProjectionExtension", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle stub
  function dbWithRules(flatPrices: Array<number | null>, unitPrices: Array<number | null>): any {
    const nextRows = flatPrices
    let calls = 0
    return {
      select() {
        const which = calls++
        return {
          from() {
            return {
              innerJoin() {
                return {
                  innerJoin() {
                    return {
                      where: async () =>
                        (which === 0 ? flatPrices : unitPrices).map((p) => ({ price: p })),
                    }
                  },
                  where: async () => nextRows.map((p) => ({ price: p })),
                }
              },
            }
          },
        }
      },
    }
  }

  it("short-circuits to row-only pricing when product has no currency", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 9900, sellCurrency: null }),
    })
    // biome-ignore lint/suspicious/noExplicitAny: db unused on this path
    const out = await ext.project({} as any, "prod_x", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(9900)
    expect(out.get("priceFromCurrency")).toBeNull()
    expect(out.get("hasPricing")).toBe(true)
  })

  it("returns empty + null currency when product is missing entirely", async () => {
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: null, sellCurrency: null }),
    })
    // biome-ignore lint/suspicious/noExplicitAny: db unused on this path
    const out = await ext.project({} as any, "prod_missing", customerSlice)
    expect(out.get("hasPricing")).toBe(false)
    expect(out.get("priceFromAmountCents")).toBeNull()
  })

  it("MINs across product price + flat rule prices + unit-rule prices", async () => {
    const db = dbWithRules([15000, 12000], [8000])
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: 20000, sellCurrency: "USD" }),
    })
    const out = await ext.project(db as AnyDrizzleDb, "prod_multi", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(8000)
    expect(out.get("priceFromCurrency")).toBe("USD")
    expect(out.get("hasPricing")).toBe(true)
  })

  it("ignores null rule prices in the candidate set", async () => {
    // Rule rows that come back with `null` baseSellAmountCents (e.g.
    // per-unit-priced rules with no flat base) must not collapse to 0.
    const db = dbWithRules([null, 18000], [null])
    const ext = createProductPricingProjectionExtension({
      loadProductPricing: async () => ({ sellAmountCents: null, sellCurrency: "USD" }),
    })
    const out = await ext.project(db as AnyDrizzleDb, "prod_nulls", customerSlice)
    expect(out.get("priceFromAmountCents")).toBe(18000)
  })
})
