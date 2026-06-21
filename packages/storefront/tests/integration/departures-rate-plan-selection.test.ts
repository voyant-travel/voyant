import { optionPriceRules, optionUnitPriceRules, priceCatalogs } from "@voyant-travel/commerce"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import {
  optionUnits,
  productLocations,
  productOptions,
  products,
} from "@voyant-travel/inventory/schema"
import { availabilitySlots, availabilityStartTimes } from "@voyant-travel/operations"
import { Hono } from "hono"
import { beforeEach, describe, expect, it } from "vitest"

import { createStorefrontPublicRoutes } from "../../src/routes-public.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

const app = new Hono()
  .use("*", async (c, next) => {
    c.set("db" as never, db)
    await next()
  })
  .route("/", createStorefrontPublicRoutes())

// Regression for #1601 gap #3: when an option carries a stray empty default
// rate plan alongside a priced (non-default) plan, the public departures
// endpoint used to return the empty default (ORDER BY is_default DESC), so the
// departure rendered "price on request". The reader must prefer a plan that
// actually carries a price.
describe.skipIf(!DB_AVAILABLE)("public departures rate-plan selection", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("prefers a priced plan over an empty default rate plan", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Carpathian Trek",
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
        name: "Double Room",
        unitType: "room",
        occupancyMin: 2,
        occupancyMax: 2,
        isHidden: false,
      })
      .returning()

    await db.insert(productLocations).values({
      productId: product.id,
      locationType: "meeting_point",
      title: "Brașov Center",
    })

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

    // An empty default plan (no unit prices) — the trap.
    const [emptyDefault] = await db
      .insert(optionPriceRules)
      .values({
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Default (empty)",
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })
      .returning()

    // The real, priced plan — not flagged default.
    const [pricedPlan] = await db
      .insert(optionPriceRules)
      .values({
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Priced plan",
        pricingMode: "per_person",
        isDefault: false,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRules).values({
      optionPriceRuleId: pricedPlan.id,
      optionId: option.id,
      unitId: unit.id,
      pricingMode: "per_booking",
      sellAmountCents: 90000,
      active: true,
    })

    const [startTime] = await db
      .insert(availabilityStartTimes)
      .values({
        productId: product.id,
        optionId: option.id,
        label: "Departure",
        startTimeLocal: "09:00",
        durationMinutes: 240,
        active: true,
      })
      .returning()

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        optionId: option.id,
        startTimeId: startTime.id,
        dateLocal: "2026-09-10",
        startsAt: new Date("2026-09-10T06:00:00.000Z"),
        endsAt: new Date("2026-09-10T10:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        remainingPax: 8,
        initialPax: 10,
      })
      .returning()

    const res = await app.request(`/products/${product.id}/departures`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(slot.id)

    const ratePlans = body.data[0].ratePlans
    expect(ratePlans).toHaveLength(1)
    // The priced plan is selected, not the empty default.
    expect(ratePlans[0].id).toBe(pricedPlan.id)
    expect(ratePlans[0].id).not.toBe(emptyDefault.id)
    expect(ratePlans[0].roomPrices).toEqual([
      {
        amount: 900,
        currencyCode: "EUR",
        roomType: {
          id: unit.id,
          name: "Double Room",
          occupancy: { adultsMin: 2, adultsMax: 2, childrenMax: 0 },
        },
      },
    ])
  })
})
