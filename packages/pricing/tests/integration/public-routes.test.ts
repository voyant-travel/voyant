import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { Hono } from "hono"
import { beforeEach, describe, expect, it } from "vitest"
import { publicPricingRoutes } from "../../src/routes-public.js"
import {
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  priceCatalogs,
} from "../../src/schema.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

const app = new Hono()
  .use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "test-user")
    await next()
  })
  .route("/", publicPricingRoutes)

describe.skipIf(!DB_AVAILABLE)("Public pricing routes", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("returns a public pricing snapshot for active public products", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Amsterdam Canal Cruise",
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
        name: "Standard Ticket",
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
        name: "Default Public Rule",
        pricingMode: "per_person",
        baseSellAmountCents: 2500,
        isDefault: true,
        active: true,
      })
      .returning()

    const [unitPrice] = await db
      .insert(optionUnitPriceRules)
      .values({
        optionPriceRuleId: rule.id,
        optionId: option.id,
        unitId: unit.id,
        pricingMode: "per_unit",
        sellAmountCents: 2500,
        active: true,
      })
      .returning()

    await db.insert(optionUnitTiers).values({
      optionUnitPriceRuleId: unitPrice.id,
      minQuantity: 2,
      maxQuantity: 4,
      sellAmountCents: 2200,
      active: true,
    })

    const [startTime] = await db
      .insert(availabilityStartTimes)
      .values({
        productId: product.id,
        optionId: option.id,
        label: "Morning",
        startTimeLocal: "09:00",
        active: true,
      })
      .returning()

    await db.insert(optionStartTimeRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      startTimeId: startTime.id,
      ruleMode: "adjustment",
      adjustmentType: "fixed",
      sellAdjustmentCents: 300,
      active: true,
    })

    const res = await app.request(`/products/${product.id}/pricing`, { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.catalog.code).toBe("PUBLIC-EUR")
    expect(body.data.catalog.currencyCode).toBe("EUR")
    expect(body.data.options).toHaveLength(1)
    expect(body.data.options[0]?.pricingRules[0]?.baseSellAmountCents).toBe(2500)
    expect(body.data.options[0]?.pricingRules[0]?.unitPrices[0]?.unitName).toBe("Adult")
    expect(body.data.options[0]?.pricingRules[0]?.unitPrices[0]?.tiers[0]?.sellAmountCents).toBe(
      2200,
    )
    expect(body.data.options[0]?.pricingRules[0]?.startTimeAdjustments[0]?.startTimeLocal).toBe(
      "09:00",
    )
  })

  it("falls back to product.sellCurrency when catalog.currencyCode is null", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Bucharest City Tour",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "RON",
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

    const [catalog] = await db
      .insert(priceCatalogs)
      .values({
        code: "PUBLIC-MULTI",
        name: "Public Retail",
        currencyCode: null,
        catalogType: "public",
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionPriceRules).values({
      productId: product.id,
      optionId: option.id,
      priceCatalogId: catalog.id,
      name: "Default",
      pricingMode: "per_person",
      baseSellAmountCents: 18900,
      isDefault: true,
      active: true,
    })

    const res = await app.request(`/products/${product.id}/pricing`, { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.catalog.currencyCode).toBe("RON")
  })

  it("returns a public availability snapshot", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Prague Walking Tour",
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
        name: "Morning Tour",
        status: "active",
      })
      .returning()

    const [startTime] = await db
      .insert(availabilityStartTimes)
      .values({
        productId: product.id,
        optionId: option.id,
        label: "Morning",
        startTimeLocal: "10:00",
        durationMinutes: 180,
        active: true,
      })
      .returning()

    await db.insert(availabilitySlots).values([
      {
        productId: product.id,
        optionId: option.id,
        startTimeId: startTime.id,
        dateLocal: "2026-05-01",
        startsAt: new Date("2026-05-01T10:00:00.000Z"),
        endsAt: new Date("2026-05-01T13:00:00.000Z"),
        timezone: "Europe/Prague",
        status: "open",
        remainingPax: 12,
      },
      {
        productId: product.id,
        optionId: option.id,
        startTimeId: startTime.id,
        dateLocal: "2026-05-02",
        startsAt: new Date("2026-05-02T10:00:00.000Z"),
        endsAt: new Date("2026-05-02T13:00:00.000Z"),
        timezone: "Europe/Prague",
        status: "cancelled",
        remainingPax: 0,
      },
    ])

    const res = await app.request(
      `/products/${product.id}/availability?dateFrom=2026-05-01&dateTo=2026-05-01`,
      { method: "GET" },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.slots).toHaveLength(1)
    expect(body.slots[0]?.status).toBe("open")
    expect(body.slots[0]?.startTime?.label).toBe("Morning")
    expect(body.slots[0]?.remainingPax).toBe(12)
  })
})
