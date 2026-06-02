import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { Hono } from "hono"
import { beforeEach, describe, expect, it } from "vitest"

import { pricingRoutes } from "../../src/routes.js"
import {
  departurePriceOverrides,
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
  pricingCategories,
} from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const db = DB_AVAILABLE ? createTestDb() : (null as never)

const app = new Hono()
  .use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "test-user")
    await next()
  })
  .route("/", pricingRoutes)

async function seedFixture() {
  const [product] = await db
    .insert(products)
    .values({
      name: "Package Tour",
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
      name: "Default",
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
      sortOrder: 0,
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

  return { product, option, unit, catalog }
}

describe.skipIf(!DB_AVAILABLE)("rate-plan matrix import", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("dry-runs and idempotently upserts a package pricing matrix", async () => {
    const { product, option, unit, catalog } = await seedFixture()
    const payload = {
      productId: product.id,
      optionId: option.id,
      priceCatalogId: catalog.id,
      schedules: [
        {
          code: "SUMMER-2026",
          name: "Summer 2026",
          recurrenceRule: "FREQ=DAILY",
          priority: 10,
        },
      ],
      pricingCategories: [
        {
          code: "DBL",
          name: "Double room",
          categoryType: "room",
          seatOccupancy: 2,
        },
      ],
      ratePlans: [
        {
          code: "SUMMER-DBL-BB",
          name: "Summer double BB",
          scheduleCode: "SUMMER-2026",
          pricingMode: "per_person",
          unitPrices: [
            {
              unitId: unit.id,
              categoryCode: "DBL",
              sellAmountCents: 129900,
            },
          ],
        },
      ],
      departureOverrides: [
        {
          departureId: "slot_matrix_2026_06_21",
          optionUnitId: unit.id,
          sellAmountCents: 139900,
        },
      ],
    }

    const dryRunRes = await app.request("/rate-plan-matrix/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(dryRunRes.status).toBe(200)
    const dryRunBody = await dryRunRes.json()
    expect(dryRunBody.summary.dryRun).toBe(true)
    expect(dryRunBody.summary.ratePlans).toMatchObject({ requested: 1, created: 1, updated: 0 })

    const applyRes = await app.request("/rate-plan-matrix/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, dryRun: false }),
    })
    expect(applyRes.status).toBe(200)
    const applyBody = await applyRes.json()
    expect(applyBody.summary.dryRun).toBe(false)
    expect(applyBody.summary.unitPrices).toMatchObject({ requested: 1, created: 1, updated: 0 })

    const [category] = await db.select().from(pricingCategories)
    const [rule] = await db.select().from(optionPriceRules)
    const [unitRule] = await db.select().from(optionUnitPriceRules)
    const [override] = await db.select().from(departurePriceOverrides)
    expect(category.code).toBe("DBL")
    expect(rule.code).toBe("SUMMER-DBL-BB")
    expect(unitRule.pricingCategoryId).toBe(category.id)
    expect(override.sellAmountCents).toBe(139900)

    const repeatRes = await app.request("/rate-plan-matrix/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, dryRun: false }),
    })
    expect(repeatRes.status).toBe(200)
    const repeatBody = await repeatRes.json()
    expect(repeatBody.summary.ratePlans).toMatchObject({ requested: 1, created: 0, updated: 1 })
    expect(repeatBody.summary.unitPrices).toMatchObject({ requested: 1, created: 0, updated: 1 })
  })
})
