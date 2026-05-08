import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import type { IndexerSlice } from "@voyantjs/products/service-catalog-plane"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { priceCatalogs } from "../../src/schema-catalogs.js"
import { optionPriceRules, optionUnitPriceRules } from "../../src/schema-option-rules.js"
import { createProductPricingProjectionExtension } from "../../src/service-catalog-plane-pricing.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const enSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe.skipIf(!DB_AVAILABLE)("createProductPricingProjectionExtension (integration)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
  let db: any
  let productId: string
  let optionId: string
  let unitId: string
  let usdCatalogId: string
  let eurCatalogId: string

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)

    productId = newId("products")
    optionId = newId("product_options")
    unitId = newId("option_units")
    usdCatalogId = newId("price_catalogs")
    eurCatalogId = newId("price_catalogs")

    await db.insert(products).values({
      id: productId,
      name: "Multi-Option Tour",
      sellCurrency: "USD",
      // No row-level price — exercise the option-rules path.
      sellAmountCents: null,
    })
    await db
      .insert(productOptions)
      .values({ id: optionId, productId, name: "Standard", code: "std" })
    await db.insert(optionUnits).values({ id: unitId, optionId, name: "Adult", code: "adult" })
    await db.insert(priceCatalogs).values([
      { id: usdCatalogId, name: "Public USD", code: "public-usd", currencyCode: "USD" },
      { id: eurCatalogId, name: "Public EUR", code: "public-eur", currencyCode: "EUR" },
    ])
  })

  it("emits empty + currency only when no rules and no row price", async () => {
    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("hasPricing")).toBe(false)
    expect(out.get("priceFromAmountCents")).toBeNull()
    expect(out.get("priceFromCurrency")).toBe("USD")
  })

  it("MINs across active default rules in the matching currency", async () => {
    await db.insert(optionPriceRules).values([
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "default",
        baseSellAmountCents: 15000,
        isDefault: true,
        active: true,
      },
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "early-bird",
        baseSellAmountCents: 9900,
        isDefault: true,
        active: true,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(9900)
    expect(out.get("priceFromCurrency")).toBe("USD")
    expect(out.get("hasPricing")).toBe(true)
  })

  it("excludes rules in non-matching currencies", async () => {
    // EUR rule with a much lower number — must NOT win the MIN, since
    // the projection's currency is the product's USD.
    await db.insert(optionPriceRules).values([
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "default-usd",
        baseSellAmountCents: 15000,
        isDefault: true,
        active: true,
      },
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: eurCatalogId,
        name: "default-eur",
        baseSellAmountCents: 5000,
        isDefault: true,
        active: true,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(15000)
  })

  it("includes rules whose catalog has a NULL currency (inherits product currency)", async () => {
    const inheritCatalogId = newId("price_catalogs")
    await db.insert(priceCatalogs).values({
      id: inheritCatalogId,
      name: "Inherit",
      code: "inherit",
      currencyCode: null,
    })
    await db.insert(optionPriceRules).values({
      id: newId("option_price_rules"),
      productId,
      optionId,
      priceCatalogId: inheritCatalogId,
      name: "default",
      baseSellAmountCents: 7700,
      isDefault: true,
      active: true,
    })

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(7700)
  })

  it("excludes inactive and non-default rules", async () => {
    await db.insert(optionPriceRules).values([
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "live-default",
        baseSellAmountCents: 15000,
        isDefault: true,
        active: true,
      },
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "promo-not-default",
        baseSellAmountCents: 4900,
        isDefault: false,
        active: true,
      },
      {
        id: newId("option_price_rules"),
        productId,
        optionId,
        priceCatalogId: usdCatalogId,
        name: "deactivated-default",
        baseSellAmountCents: 1000,
        isDefault: true,
        active: false,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(15000)
  })

  it("includes per-unit price tiers in the MIN", async () => {
    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "per-unit",
      // Flat base is null — actual prices live on per-unit rules.
      baseSellAmountCents: null,
      isDefault: true,
      active: true,
    })
    await db.insert(optionUnitPriceRules).values([
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId,
        sellAmountCents: 8500,
        active: true,
      },
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId,
        sellAmountCents: 12000,
        active: true,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(8500)
  })

  it("MINs the product row sellAmountCents against rules", async () => {
    // Row default is 5000, rule is 9900 — row wins.
    const { sql } = await import("drizzle-orm")
    await db.execute(sql`UPDATE products SET sell_amount_cents = 5000 WHERE id = ${productId}`)

    await db.insert(optionPriceRules).values({
      id: newId("option_price_rules"),
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "default",
      baseSellAmountCents: 9900,
      isDefault: true,
      active: true,
    })

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(5000)
  })
})
