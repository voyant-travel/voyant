import { availabilitySlots } from "@voyantjs/availability/schema"
import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import type { IndexerSlice } from "@voyantjs/products/service-catalog-plane"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { priceCatalogs } from "../../src/schema-catalogs.js"
import { pricingCategories } from "../../src/schema-categories.js"
import {
  optionPriceRules,
  optionUnitPriceRules,
  optionUnitTiers,
} from "../../src/schema-option-rules.js"
import { createProductPricingProjectionExtension } from "../../src/service-catalog-plane-pricing.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const enSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe.skipIf(!DB_AVAILABLE)("createProductPricingProjectionExtension (integration)", () => {
  let db: ReturnType<typeof createTestDb>
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
      .values({ id: optionId, productId, name: "Standard", code: "std", status: "active" })
    await db
      .insert(optionUnits)
      .values({ id: unitId, optionId, name: "Adult", code: "adult", unitType: "person" })
    await db.insert(availabilitySlots).values({
      id: newId("availability_slots"),
      productId,
      optionId,
      dateLocal: "2030-01-01",
      startsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      timezone: "UTC",
      status: "open",
      unlimited: true,
    })
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

  it("prefers unrestricted adult category prices over cheaper child category prices", async () => {
    const adultCategoryId = newId("pricing_categories")
    const childCategoryId = newId("pricing_categories")
    await db.insert(pricingCategories).values([
      {
        id: adultCategoryId,
        productId,
        optionId,
        unitId,
        name: "Adult",
        code: "adult",
        categoryType: "adult",
      },
      {
        id: childCategoryId,
        productId,
        optionId,
        unitId,
        name: "Child 0-5",
        code: "child-0-5",
        categoryType: "child",
        minAge: 0,
        maxAge: 5,
      },
    ])

    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "per-person",
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
        pricingCategoryId: adultCategoryId,
        sellAmountCents: 48000,
        active: true,
      },
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId,
        pricingCategoryId: childCategoryId,
        sellAmountCents: 24000,
        active: true,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(48000)
  })

  it.each([
    ["person", false],
    ["room", true],
  ] as const)("treats adult %s age floors and zero quantity bounds as standard pricing", async (_unitLabel, roomUnit) => {
    const pricedUnitId = roomUnit ? newId("option_units") : unitId
    if (roomUnit) {
      await db.insert(optionUnits).values({
        id: pricedUnitId,
        optionId,
        name: "Double Room",
        code: "adult-room",
        unitType: "room",
        occupancyMin: 1,
        occupancyMax: 2,
      })
    }

    const adultCategoryId = newId("pricing_categories")
    const childCategoryId = newId("pricing_categories")
    const infantCategoryId = newId("pricing_categories")
    await db.insert(pricingCategories).values([
      {
        id: adultCategoryId,
        productId,
        optionId,
        unitId: pricedUnitId,
        name: "Adult 18+",
        code: roomUnit ? "adult-room-18-plus" : "adult-18-plus",
        categoryType: "adult",
        minAge: 18,
      },
      {
        id: childCategoryId,
        productId,
        optionId,
        unitId: pricedUnitId,
        name: "Child 0-5",
        code: roomUnit ? "child-room-zero-five" : "child-zero-five",
        categoryType: "child",
        minAge: 0,
        maxAge: 5,
      },
      {
        id: infantCategoryId,
        productId,
        optionId,
        unitId: pricedUnitId,
        name: "Infant 0-1",
        code: roomUnit ? "infant-room-zero-one" : "infant-zero-one",
        categoryType: "infant",
        minAge: 0,
        maxAge: 1,
      },
    ])

    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: roomUnit ? "room-age-floor" : "adult-age-floor",
      baseSellAmountCents: null,
      isDefault: true,
      active: true,
    })
    await db.insert(optionUnitPriceRules).values([
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId: pricedUnitId,
        pricingCategoryId: adultCategoryId,
        sellAmountCents: 48000,
        minQuantity: 0,
        maxQuantity: 0,
        active: true,
      },
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId: pricedUnitId,
        pricingCategoryId: childCategoryId,
        sellAmountCents: 24000,
        minQuantity: 0,
        maxQuantity: 0,
        active: true,
      },
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId: pricedUnitId,
        pricingCategoryId: infantCategoryId,
        sellAmountCents: 12000,
        minQuantity: 0,
        maxQuantity: 0,
        active: true,
      },
    ])

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(48000)
  })

  it("prefers unrestricted adult prices over cheaper quantity tiers and child prices", async () => {
    const adultCategoryId = newId("pricing_categories")
    const childCategoryId = newId("pricing_categories")
    await db.insert(pricingCategories).values([
      {
        id: adultCategoryId,
        productId,
        optionId,
        unitId,
        name: "Adult",
        code: "adult-tiered",
        categoryType: "adult",
      },
      {
        id: childCategoryId,
        productId,
        optionId,
        unitId,
        name: "Child 0-5",
        code: "child-tiered",
        categoryType: "child",
        minAge: 0,
        maxAge: 5,
      },
    ])

    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "tiered-per-person",
      baseSellAmountCents: null,
      isDefault: true,
      active: true,
    })

    const adultUnitRuleId = newId("option_unit_price_rules")
    await db.insert(optionUnitPriceRules).values([
      {
        id: adultUnitRuleId,
        optionPriceRuleId: ruleId,
        optionId,
        unitId,
        pricingCategoryId: adultCategoryId,
        sellAmountCents: 48000,
        active: true,
      },
      {
        id: newId("option_unit_price_rules"),
        optionPriceRuleId: ruleId,
        optionId,
        unitId,
        pricingCategoryId: childCategoryId,
        sellAmountCents: 24000,
        active: true,
      },
    ])
    await db.insert(optionUnitTiers).values({
      id: newId("option_unit_tiers"),
      optionUnitPriceRuleId: adultUnitRuleId,
      minQuantity: 2,
      sellAmountCents: 40000,
      active: true,
    })

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(48000)
  })

  it("falls back to restricted category pricing when no standard price exists", async () => {
    const childCategoryId = newId("pricing_categories")
    await db.insert(pricingCategories).values({
      id: childCategoryId,
      productId,
      optionId,
      unitId,
      name: "Child 0-5",
      code: "child-only",
      categoryType: "child",
      minAge: 0,
      maxAge: 5,
    })

    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "child-only",
      baseSellAmountCents: null,
      isDefault: true,
      active: true,
    })
    await db.insert(optionUnitPriceRules).values({
      id: newId("option_unit_price_rules"),
      optionPriceRuleId: ruleId,
      optionId,
      unitId,
      pricingCategoryId: childCategoryId,
      sellAmountCents: 24000,
      active: true,
    })

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(24000)
  })

  it("prefers future rate-plan rules over stale product row pricing", async () => {
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
    expect(out.get("priceFromAmountCents")).toBe(9900)
  })

  it("prefers standard room prices over quantity-tier room prices and stale zero row pricing", async () => {
    const { sql } = await import("drizzle-orm")
    await db.execute(sql`UPDATE products SET sell_amount_cents = 0 WHERE id = ${productId}`)

    const roomUnitId = newId("option_units")
    await db.insert(optionUnits).values({
      id: roomUnitId,
      optionId,
      name: "Double Room",
      code: "double",
      unitType: "room",
      occupancyMin: 1,
      occupancyMax: 2,
    })

    const ruleId = newId("option_price_rules")
    await db.insert(optionPriceRules).values({
      id: ruleId,
      productId,
      optionId,
      priceCatalogId: usdCatalogId,
      name: "room-rate",
      baseSellAmountCents: 25000,
      isDefault: true,
      active: true,
    })

    const unitRuleId = newId("option_unit_price_rules")
    await db.insert(optionUnitPriceRules).values({
      id: unitRuleId,
      optionPriceRuleId: ruleId,
      optionId,
      unitId: roomUnitId,
      sellAmountCents: 18000,
      active: true,
    })
    await db.insert(optionUnitTiers).values({
      id: newId("option_unit_tiers"),
      optionUnitPriceRuleId: unitRuleId,
      minQuantity: 2,
      sellAmountCents: 16500,
      active: true,
    })

    const ext = createProductPricingProjectionExtension()
    const out = await ext.project(db, productId, enSlice)
    expect(out.get("priceFromAmountCents")).toBe(18000)
    expect(out.get("hasPricing")).toBe(true)
  })
})
