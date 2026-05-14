import { availabilitySlots } from "@voyantjs/availability/schema"
import { cleanupTestDb, closeTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { bookingPaymentSchedules } from "@voyantjs/finance/schema"
import { handleApiError } from "@voyantjs/hono"
import { optionPriceRules, optionUnitPriceRules, priceCatalogs } from "@voyantjs/pricing/schema"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createStorefrontPublicRoutes } from "../../src/routes-public.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const ORIGINAL_CHECKOUT_CAPABILITY_SECRET = process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Storefront booking-session bootstrap route", () => {
  let app: Hono
  let db: ReturnType<typeof createTestDb>

  beforeAll(async () => {
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = "storefront-bootstrap-test-secret-32"
    db = createTestDb()
    app = new Hono()
      .onError(handleApiError)
      .use("*", async (c, next) => {
        c.set("db" as never, db)
        c.set("userId" as never, "storefront-bootstrap-test-user")
        await next()
      })
      .route(
        "/",
        createStorefrontPublicRoutes({
          bookingSessionBootstrap: {
            today: new Date("2026-05-14T00:00:00.000Z"),
            paymentPolicy: {
              deposit: { kind: "percent", percent: 30 },
              minDaysBeforeDepartureForDeposit: 1,
              balanceDueDaysBeforeDeparture: 30,
              balanceDueMinDaysFromNow: 7,
            },
          },
        }),
      )
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = ORIGINAL_CHECKOUT_CAPABILITY_SECRET
    await closeTestDb()
  })

  async function seedDeparture() {
    const [product] = await db
      .insert(products)
      .values({
        name: "Bootstrap Danube Cruise",
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
        name: "Main departure",
        status: "active",
        isDefault: true,
      })
      .returning()

    const [unit] = await db
      .insert(optionUnits)
      .values({
        optionId: option.id,
        name: "Double cabin",
        unitType: "room",
        occupancyMin: 2,
        occupancyMax: 2,
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
        name: "Public room rate",
        pricingMode: "per_booking",
        baseSellAmountCents: 50000,
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: unit.id,
      pricingMode: "per_booking",
      sellAmountCents: 50000,
      active: true,
    })

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T05:30:00.000Z"),
        endsAt: new Date("2026-08-08T13:30:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: 10,
        remainingPax: 10,
        pastCutoff: false,
        tooEarly: false,
      })
      .returning()

    return { product, option, unit, slot }
  }

  function bootstrapPayload(seed: Awaited<ReturnType<typeof seedDeparture>>) {
    return {
      departureId: seed.slot.id,
      slotId: seed.slot.id,
      quote: {
        currencyCode: "EUR",
        totalSellAmountCents: 50000,
        quotedAt: "2026-05-14T00:00:00.000Z",
        expiresAt: "2026-05-14T00:30:00.000Z",
      },
      session: {
        sellCurrency: "EUR",
        pax: 1,
        startDate: "2026-08-01",
        endDate: "2026-08-08",
        items: [
          {
            title: "Danube cruise cabin",
            availabilitySlotId: seed.slot.id,
            quantity: 1,
            productId: seed.product.id,
            optionId: seed.option.id,
            optionUnitId: seed.unit.id,
          },
        ],
        travelers: [
          {
            firstName: "Ana",
            lastName: "Popescu",
            email: "ana@example.com",
            isPrimary: true,
          },
        ],
      },
    }
  }

  it("bootstraps a booking session with payment, repricing, availability, and allocation", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json(bootstrapPayload(seed)),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.currency).toBe("EUR")
    expect(body.data.session.status).toBe("on_hold")
    expect(body.data.session.checkoutCapability.actions).toContain("payment:start")
    expect(body.data.paymentPlan).toEqual({
      source: "storefront_default",
      depositKind: "percent",
      depositPercent: 30,
      depositAmountCents: null,
      requiresFullPayment: false,
    })
    expect(body.data.paymentSchedule).toEqual([
      expect.objectContaining({
        scheduleType: "deposit",
        status: "due",
        dueDate: "2026-05-14",
        currency: "EUR",
        amountCents: 15000,
      }),
      expect.objectContaining({
        scheduleType: "balance",
        status: "pending",
        dueDate: "2026-07-02",
        currency: "EUR",
        amountCents: 35000,
      }),
    ])
    expect(body.data.repricing).toEqual({
      originalQuote: {
        currencyCode: "EUR",
        totalSellAmountCents: 50000,
        quotedAt: "2026-05-14T00:00:00.000Z",
        expiresAt: "2026-05-14T00:30:00.000Z",
      },
      current: expect.objectContaining({
        sessionId: body.data.session.sessionId,
        currencyCode: "EUR",
        totalSellAmountCents: 50000,
        appliedToSession: true,
      }),
      deltaAmountCents: 0,
      staleQuote: false,
    })
    expect(body.data.repricing.current.items[0]).toEqual(
      expect.objectContaining({
        itemId: body.data.session.items[0].id,
        optionUnitId: seed.unit.id,
        totalSellAmountCents: 50000,
      }),
    )
    expect(body.data.availability).toEqual(
      expect.objectContaining({
        departureId: seed.slot.id,
        slotId: seed.slot.id,
        productId: seed.product.id,
        optionId: seed.option.id,
        remaining: 9,
      }),
    )
    expect(body.data.allocation).toHaveLength(1)
    expect(body.data.allocation[0]).toEqual(
      expect.objectContaining({
        availabilitySlotId: seed.slot.id,
        optionUnitId: seed.unit.id,
        quantity: 1,
        status: "held",
      }),
    )

    const schedules = await db
      .select()
      .from(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.bookingId, body.data.session.sessionId))
    expect(schedules).toHaveLength(2)
  })

  it("rejects missing session input", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json({
        departureId: seed.slot.id,
        slotId: seed.slot.id,
        quote: { currencyCode: "EUR", totalSellAmountCents: 50000 },
      }),
    })

    expect(res.status).toBe(400)
  })

  it("rejects invalid departure and slot inputs", async () => {
    const seed = await seedDeparture()

    const invalidDepartureRes = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json({ ...bootstrapPayload(seed), departureId: "slot_missing" }),
    })
    expect(invalidDepartureRes.status).toBe(404)

    const invalidSlotRes = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json({ ...bootstrapPayload(seed), slotId: "slot_missing" }),
    })
    expect(invalidSlotRes.status).toBe(400)
  })

  it("rejects stale quote inputs before creating a booking session", async () => {
    const seed = await seedDeparture()
    const payload = bootstrapPayload(seed)

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json({
        ...payload,
        quote: {
          ...payload.quote,
          totalSellAmountCents: 49000,
        },
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("Booking session quote is stale")
    expect(body.data.repricing).toEqual(
      expect.objectContaining({
        deltaAmountCents: 1000,
        staleQuote: true,
      }),
    )
  })
})
