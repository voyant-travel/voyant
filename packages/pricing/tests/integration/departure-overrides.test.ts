import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/inventory/schema"
import { availabilitySlots } from "@voyantjs/operations/availability/schema"
import { Hono } from "hono"
import { beforeEach, describe, expect, it } from "vitest"

import { publicPricingRoutes } from "../../src/routes-public.js"
import {
  departurePriceOverrides,
  optionPriceRules,
  optionUnitPriceRules,
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

async function seedFixture(opts: { adultPrice: number; childPrice: number }) {
  const [product] = await db
    .insert(products)
    .values({
      name: "Bulgaria Day Trip",
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
      name: "Default",
      status: "active",
      isDefault: true,
    })
    .returning()
  const [adultUnit] = await db
    .insert(optionUnits)
    .values({
      optionId: option.id,
      name: "Adult",
      unitType: "person",
      isHidden: false,
      sortOrder: 0,
    })
    .returning()
  const [childUnit] = await db
    .insert(optionUnits)
    .values({
      optionId: option.id,
      name: "Child",
      unitType: "person",
      isHidden: false,
      sortOrder: 1,
    })
    .returning()
  const [catalog] = await db
    .insert(priceCatalogs)
    .values({
      code: "PUBLIC-RON",
      name: "Public RON",
      currencyCode: "RON",
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
      baseSellAmountCents: opts.adultPrice,
      isDefault: true,
      active: true,
      allPricingCategories: true,
    })
    .returning()
  await db.insert(optionUnitPriceRules).values([
    {
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: adultUnit.id,
      pricingMode: "per_unit",
      sellAmountCents: opts.adultPrice,
      active: true,
    },
    {
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: childUnit.id,
      pricingMode: "per_unit",
      sellAmountCents: opts.childPrice,
      active: true,
    },
  ])
  const [slot] = await db
    .insert(availabilitySlots)
    .values({
      productId: product.id,
      optionId: option.id,
      dateLocal: "2026-06-21",
      startsAt: new Date("2026-06-21T07:00:00Z"),
      status: "open",
    })
    .returning()
  return { product, option, adultUnit, childUnit, catalog, rule, slot }
}

async function fetchSnapshot(productId: string, departureId?: string) {
  const url = departureId
    ? `/products/${productId}/pricing?departureId=${encodeURIComponent(departureId)}`
    : `/products/${productId}/pricing`
  const res = await app.request(url, { method: "GET" })
  expect(res.status).toBe(200)
  const body = (await res.json()) as {
    data: {
      options: Array<{
        pricingRules: Array<{
          unitPrices: Array<{ unitId: string; unitName: string; sellAmountCents: number | null }>
        }>
      }>
    }
  }
  return body.data.options[0]?.pricingRules[0]?.unitPrices ?? []
}

describe.skipIf(!DB_AVAILABLE)("departure_price_overrides", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("override beats unit price for the targeted unit only", async () => {
    const { product, adultUnit, childUnit, catalog, slot } = await seedFixture({
      adultPrice: 14500,
      childPrice: 9500,
    })
    await db.insert(departurePriceOverrides).values({
      departureId: slot.id,
      optionId: adultUnit.optionId,
      optionUnitId: adultUnit.id,
      priceCatalogId: catalog.id,
      sellAmountCents: 16000,
      active: true,
    })

    const prices = await fetchSnapshot(product.id, slot.id)
    const adult = prices.find((p) => p.unitId === adultUnit.id)
    const child = prices.find((p) => p.unitId === childUnit.id)
    expect(adult?.sellAmountCents).toBe(16000)
    expect(child?.sellAmountCents).toBe(9500)
  })

  it("falls through to unit price when no override exists", async () => {
    const { product, adultUnit, slot } = await seedFixture({
      adultPrice: 14500,
      childPrice: 9500,
    })

    const prices = await fetchSnapshot(product.id, slot.id)
    const adult = prices.find((p) => p.unitId === adultUnit.id)
    expect(adult?.sellAmountCents).toBe(14500)
  })

  it("ignores inactive overrides", async () => {
    const { product, adultUnit, catalog, slot } = await seedFixture({
      adultPrice: 14500,
      childPrice: 9500,
    })
    await db.insert(departurePriceOverrides).values({
      departureId: slot.id,
      optionId: adultUnit.optionId,
      optionUnitId: adultUnit.id,
      priceCatalogId: catalog.id,
      sellAmountCents: 16000,
      active: false,
    })

    const prices = await fetchSnapshot(product.id, slot.id)
    const adult = prices.find((p) => p.unitId === adultUnit.id)
    expect(adult?.sellAmountCents).toBe(14500)
  })

  it("supports multiple per-unit overrides on the same departure", async () => {
    const { product, adultUnit, childUnit, catalog, slot } = await seedFixture({
      adultPrice: 14500,
      childPrice: 9500,
    })
    await db.insert(departurePriceOverrides).values([
      {
        departureId: slot.id,
        optionId: adultUnit.optionId,
        optionUnitId: adultUnit.id,
        priceCatalogId: catalog.id,
        sellAmountCents: 16000,
        active: true,
      },
      {
        departureId: slot.id,
        optionId: childUnit.optionId,
        optionUnitId: childUnit.id,
        priceCatalogId: catalog.id,
        sellAmountCents: 11000,
        active: true,
      },
    ])

    const prices = await fetchSnapshot(product.id, slot.id)
    expect(prices.find((p) => p.unitId === adultUnit.id)?.sellAmountCents).toBe(16000)
    expect(prices.find((p) => p.unitId === childUnit.id)?.sellAmountCents).toBe(11000)
  })

  it("does not apply overrides when departureId is omitted", async () => {
    const { product, adultUnit, catalog, slot } = await seedFixture({
      adultPrice: 14500,
      childPrice: 9500,
    })
    await db.insert(departurePriceOverrides).values({
      departureId: slot.id,
      optionId: adultUnit.optionId,
      optionUnitId: adultUnit.id,
      priceCatalogId: catalog.id,
      sellAmountCents: 16000,
      active: true,
    })

    const prices = await fetchSnapshot(product.id)
    const adult = prices.find((p) => p.unitId === adultUnit.id)
    expect(adult?.sellAmountCents).toBe(14500)
  })
})
