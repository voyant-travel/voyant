import { availabilitySlots } from "@voyantjs/availability/schema"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import type { PaymentPolicy } from "@voyantjs/finance"
import { optionPriceRules, optionUnitPriceRules, priceCatalogs } from "@voyantjs/pricing/schema"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createStorefrontPublicRoutes } from "../../src/routes-public.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const ORIGINAL_CHECKOUT_CAPABILITY_SECRET = process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET

const db = DB_AVAILABLE ? createTestDb() : (null as never)

describe.skipIf(!DB_AVAILABLE)("Storefront booking bootstrap public route", () => {
  beforeAll(() => {
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = "storefront-bootstrap-test-secret-32"
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = ORIGINAL_CHECKOUT_CAPABILITY_SECRET
    await closeTestDb()
  })

  async function seedBootstrapSlot(overrides: Partial<typeof availabilitySlots.$inferInsert> = {}) {
    const [product] = await db
      .insert(products)
      .values({
        id: "prod_bootstrap",
        name: "Public booking bootstrap tour",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [option] = await db
      .insert(productOptions)
      .values({
        id: "opt_bootstrap",
        productId: product.id,
        name: "Main departure",
        status: "active",
        isDefault: true,
      })
      .returning()

    const [unit] = await db
      .insert(optionUnits)
      .values({
        id: "ount_bootstrap_double",
        optionId: option.id,
        name: "Double room",
        unitType: "room",
        occupancyMin: 2,
        occupancyMax: 2,
        isHidden: false,
      })
      .returning()

    const [catalog] = await db
      .insert(priceCatalogs)
      .values({
        id: "pcat_bootstrap",
        code: "BOOTSTRAP-EUR",
        name: "Bootstrap EUR",
        currencyCode: "EUR",
        catalogType: "public",
        isDefault: true,
        active: true,
      })
      .returning()

    const [rule] = await db
      .insert(optionPriceRules)
      .values({
        id: "opru_bootstrap",
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Bootstrap room rule",
        pricingMode: "per_booking",
        baseSellAmountCents: 120000,
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: unit.id,
      pricingMode: "per_booking",
      sellAmountCents: 120000,
      active: true,
    })

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        id: "avsl_bootstrap",
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T09:00:00.000Z"),
        endsAt: new Date("2026-08-08T09:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: 10,
        remainingPax: 10,
        pastCutoff: false,
        tooEarly: false,
        ...overrides,
      })
      .returning()

    return { product, option, unit, slot }
  }

  it("bootstraps a public booking session with payment plan, repricing, availability, allocation, and currency", async () => {
    const seeded = await seedBootstrapSlot()
    const policy: PaymentPolicy = {
      deposit: { kind: "percent", percent: 25 },
      minDaysBeforeDepartureForDeposit: 0,
      balanceDueDaysBeforeDeparture: 30,
      balanceDueMinDaysFromNow: 0,
    }
    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db" as never, db)
        await next()
      })
      .route(
        "/",
        createStorefrontPublicRoutes({
          bookingBootstrap: {
            resolvePaymentPolicy: () => ({ policy, source: "operator_default" }),
          },
        }),
      )

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      body: JSON.stringify({
        departureId: seeded.slot.id,
        slotId: seeded.slot.id,
        quote: {
          currency: "EUR",
          totalSellAmountCents: 100000,
          quotedAt: "2026-05-14T10:00:00.000Z",
          expiresAt: "2026-12-31T00:00:00.000Z",
        },
        session: {
          sellCurrency: "EUR",
          pax: 2,
          items: [
            {
              title: "Romania circuit",
              availabilitySlotId: seeded.slot.id,
              quantity: 1,
              totalSellAmountCents: 100000,
              productId: seeded.product.id,
              optionId: seeded.option.id,
            },
          ],
          travelers: [
            {
              firstName: "Ana",
              lastName: "Popescu",
              email: "ana@example.com",
              isPrimary: true,
            },
            {
              firstName: "Mihai",
              lastName: "Popescu",
              email: "mihai@example.com",
            },
          ],
        },
        reprice: {
          applyToSession: true,
          selections: [
            {
              itemIndex: 0,
              optionUnitId: seeded.unit.id,
              quantity: 1,
            },
          ],
        },
      }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(201)
    expect(res.headers.get("set-cookie")).toContain("voyant_checkout_session=")
    const body = await res.json()

    expect(body.data.currency).toBe("EUR")
    expect(body.data.session.status).toBe("on_hold")
    expect(body.data.session.checkoutCapability.actions).toContain("payment:start")
    expect(body.data.session.allocations).toEqual([
      expect.objectContaining({
        availabilitySlotId: seeded.slot.id,
        quantity: 1,
        status: "held",
      }),
    ])
    expect(body.data.availability).toMatchObject({
      departureId: seeded.slot.id,
      slotId: seeded.slot.id,
      productId: seeded.product.id,
      status: "open",
      remainingPax: 9,
    })
    expect(body.data.pricing).toMatchObject({
      originalTotalSellAmountCents: 100000,
      currentTotalSellAmountCents: 120000,
      deltaSellAmountCents: 20000,
      appliedToSession: true,
    })
    expect(body.data.pricing.items[0]).toMatchObject({
      optionUnitId: seeded.unit.id,
      totalSellAmountCents: 120000,
    })
    expect(body.data.paymentPlan).toMatchObject({
      source: "computed_policy",
      policySource: "operator_default",
    })
    expect(body.data.paymentPlan.schedules).toEqual([
      expect.objectContaining({
        scheduleType: "deposit",
        amountCents: 30000,
        currency: "EUR",
      }),
      expect.objectContaining({
        scheduleType: "balance",
        dueDate: "2026-07-02",
        amountCents: 90000,
        currency: "EUR",
      }),
    ])
    expect(body.data.dueDates).toEqual([
      expect.objectContaining({ scheduleType: "deposit", amountCents: 30000 }),
      expect.objectContaining({ scheduleType: "balance", amountCents: 90000 }),
    ])
  })
})
