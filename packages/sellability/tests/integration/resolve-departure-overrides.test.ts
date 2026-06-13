import {
  departurePriceOverrides,
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
  pricingCategories,
} from "@voyantjs/commerce/pricing/schema"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/inventory/schema"
import { availabilitySlots } from "@voyantjs/operations/availability/schema"
import { beforeEach, describe, expect, it } from "vitest"

import { sellabilityService } from "../../src/service.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

describe.skipIf(!DB_AVAILABLE)("sellabilityService.resolve departure overrides", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("applies departure overrides when requested unit resolves by pricing category", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Category Override Tour",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [option] = await db
      .insert(productOptions)
      .values({
        productId: product.id,
        name: "Standard",
        status: "active",
        isDefault: true,
      })
      .returning()

    const [unit] = await db
      .insert(optionUnits)
      .values({
        optionId: option.id,
        name: "Adult",
        unitType: "person",
        isHidden: false,
      })
      .returning()

    const [category] = await db
      .insert(pricingCategories)
      .values({
        productId: product.id,
        optionId: option.id,
        unitId: unit.id,
        code: "adult",
        name: "Adult",
        categoryType: "adult",
        active: true,
      })
      .returning()

    const [catalog] = await db
      .insert(priceCatalogs)
      .values({
        code: "PUBLIC-EUR",
        name: "Public EUR",
        currencyCode: "EUR",
        catalogType: "public",
        isDefault: true,
        active: true,
      })
      .returning()

    const [rule] = await db
      .insert(optionPriceRules)
      .values({
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Public rate",
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: unit.id,
      pricingCategoryId: category.id,
      pricingMode: "per_unit",
      sellAmountCents: 30000,
      active: true,
    })

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T08:00:00.000Z"),
        endsAt: new Date("2026-08-01T10:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        remainingPax: 12,
        pastCutoff: false,
        tooEarly: false,
      })
      .returning()

    await db.insert(departurePriceOverrides).values({
      departureId: slot.id,
      optionId: option.id,
      optionUnitId: unit.id,
      priceCatalogId: catalog.id,
      sellAmountCents: 45000,
      active: true,
    })

    const resolved = await sellabilityService.resolve(db, {
      productId: product.id,
      optionId: option.id,
      slotId: slot.id,
      requestedUnits: [
        {
          pricingCategoryId: category.id,
          quantity: 2,
        },
      ],
      limit: 10,
    })

    expect(resolved.data).toHaveLength(1)
    expect(resolved.data[0]?.pricing.sellAmountCents).toBe(90000)
    expect(resolved.data[0]?.pricing.components[0]).toEqual(
      expect.objectContaining({
        kind: "unit",
        sellAmountCents: 90000,
        sourceRuleId: expect.any(String),
      }),
    )
  })
})
