// agent-quality: file-size exception -- owner: storefront; the sync + compat bootstrap cases share one seed harness and stay co-located until a dedicated split preserves coverage.

import { bookings } from "@voyant-travel/bookings/schema"
import {
  departurePriceOverrides,
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
} from "@voyant-travel/commerce"
import { cleanupTestDb, closeTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { bookingPaymentSchedules } from "@voyant-travel/finance/schema"
import { handleApiError } from "@voyant-travel/hono"
import { optionUnits, productOptions, products } from "@voyant-travel/inventory/schema"
import { availabilitySlots } from "@voyant-travel/operations"
import { organizations, people } from "@voyant-travel/relationships"
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
        const authContext = c.req.header("x-test-auth-context")
        if (authContext === "explicit-guest") {
          c.set("isAnonymousRequest" as never, true)
        } else if (authContext === "staff-session") {
          c.set("userId" as never, "staff-user")
          c.set("sessionId" as never, "staff-session")
          c.set("actor" as never, "staff")
          c.set("realm" as never, "admin")
          c.set("callerType" as never, "session")
        } else if (authContext === "api-key") {
          c.set("actor" as never, "staff")
          c.set("callerType" as never, "api_key")
          c.set("apiKeyId" as never, "accepted-api-key")
        } else if (authContext === "customer-missing-realm") {
          c.set("userId" as never, "customer-missing-realm")
          c.set("sessionId" as never, "customer-session-missing-realm")
          c.set("actor" as never, "customer")
          c.set("callerType" as never, "session")
        }
        if (c.req.header("x-test-customer") === "1") {
          c.set("userId" as never, "storefront-bootstrap-test-user")
          c.set("sessionId" as never, "customer-session-storefront")
          c.set("actor" as never, "customer")
          c.set("realm" as never, "customer")
          const kind = c.req.header("x-test-buyer-kind")
          if (kind === "personal") {
            c.set("buyerAccountId" as never, "personal:storefront-bootstrap-test-user")
            c.set("buyerAccountKind" as never, "personal")
            c.set("relationshipPersonId" as never, "person-storefront-owner")
          } else if (kind === "business") {
            c.set("buyerAccountId" as never, "business:auth-org-storefront")
            c.set("buyerAccountKind" as never, "business")
            c.set("authOrganizationId" as never, "auth-org-storefront")
            c.set("relationshipOrganizationId" as never, "org-storefront-owner")
            c.set("buyerMembershipId" as never, "member-storefront")
            c.set("buyerMembershipRole" as never, "member")
          }
        }
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

  async function seedDeparture(options: { competingDefaultOption?: boolean } = {}) {
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
        isDefault: !options.competingDefaultOption,
        sortOrder: options.competingDefaultOption ? 10 : 0,
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

    if (options.competingDefaultOption) {
      const [defaultOption] = await db
        .insert(productOptions)
        .values({
          productId: product.id,
          name: "Default but unselected departure",
          status: "active",
          isDefault: true,
          sortOrder: 0,
        })
        .returning()

      const [defaultUnit] = await db
        .insert(optionUnits)
        .values({
          optionId: defaultOption.id,
          name: "Default cabin",
          unitType: "room",
          occupancyMin: 2,
          occupancyMax: 2,
          isHidden: false,
        })
        .returning()

      const [defaultRule] = await db
        .insert(optionPriceRules)
        .values({
          productId: product.id,
          optionId: defaultOption.id,
          priceCatalogId: catalog.id,
          name: "Default room rate",
          pricingMode: "per_booking",
          baseSellAmountCents: 40000,
          isDefault: true,
          active: true,
        })
        .returning()

      await db.insert(optionUnitPriceRules).values({
        optionPriceRuleId: defaultRule.id,
        optionId: defaultOption.id,
        unitId: defaultUnit.id,
        pricingMode: "per_booking",
        sellAmountCents: 40000,
        active: true,
      })
    }

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

    return { product, option, unit, catalog, slot }
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

  it("replays duplicate bootstrap requests with the same idempotency key", async () => {
    const seed = await seedDeparture()
    const payload = bootstrapPayload(seed)
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "bootstrap-idempotency-1",
    }

    const first = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
    expect(first.status).toBe(201)
    const firstBody = await first.json()

    const replay = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
    expect(replay.status).toBe(201)
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
    const replayBody = await replay.json()
    expect(replayBody.data.session.sessionId).toBe(firstBody.data.session.sessionId)

    const schedules = await db
      .select()
      .from(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.bookingId, firstBody.data.session.sessionId))
    expect(schedules).toHaveLength(2)

    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.id, seed.slot.id))
      .limit(1)
    expect(slot?.remainingPax).toBe(9)
  })

  it("allows an explicit guest marker to bootstrap an ownerless booking", async () => {
    const seed = await seedDeparture()
    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-auth-context": "explicit-guest" },
      body: JSON.stringify(bootstrapPayload(seed)),
    })

    expect(res.status).toBe(201)
    const session = (await res.json()).data.session
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, session.sessionId))
    expect(booking).toEqual(expect.objectContaining({ personId: null, organizationId: null }))
  })

  it.each([
    "staff-session",
    "api-key",
    "customer-missing-realm",
  ])("never downgrades an accepted %s context to a guest bootstrap", async (authContext) => {
    const seed = await seedDeparture()
    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-auth-context": authContext },
      body: JSON.stringify(bootstrapPayload(seed)),
    })

    expect(res.status).toBe(401)
    expect(await db.select({ id: bookings.id }).from(bookings)).toEqual([])
  })

  it("prices bootstrap sessions with departure price overrides", async () => {
    const seed = await seedDeparture()
    await db.insert(departurePriceOverrides).values({
      departureId: seed.slot.id,
      optionId: seed.option.id,
      optionUnitId: seed.unit.id,
      priceCatalogId: seed.catalog.id,
      sellAmountCents: 70000,
      active: true,
    })

    const payload = bootstrapPayload(seed)
    payload.quote.totalSellAmountCents = 70000

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json(payload),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.session.sellAmountCents).toBe(70000)
    expect(body.data.session.items[0]).toEqual(
      expect.objectContaining({
        optionUnitId: seed.unit.id,
        unitSellAmountCents: 70000,
        totalSellAmountCents: 70000,
      }),
    )
    expect(body.data.repricing.current).toEqual(
      expect.objectContaining({
        totalSellAmountCents: 70000,
        appliedToSession: true,
      }),
    )
    expect(body.data.repricing.current.items[0]).toEqual(
      expect.objectContaining({
        optionUnitId: seed.unit.id,
        unitSellAmountCents: 70000,
        totalSellAmountCents: 70000,
      }),
    )
  })

  it("prices omitted item option ids against the selected slot option", async () => {
    const seed = await seedDeparture({ competingDefaultOption: true })
    const payload = bootstrapPayload(seed)
    delete payload.session.items[0]?.optionId

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      ...json(payload),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.repricing.current.totalSellAmountCents).toBe(50000)
    expect(body.data.session.items[0]).toEqual(
      expect.objectContaining({
        productId: seed.product.id,
        optionId: seed.option.id,
        optionUnitId: seed.unit.id,
      }),
    )
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
    expect(body.code).toBe("QUOTE_STALE")
    expect(body.retryable).toBe(true)
    expect(body.data.repricing).toEqual(
      expect.objectContaining({
        deltaAmountCents: 1000,
        staleQuote: true,
      }),
    )
  })

  it("stamps the active personal buyer on synchronous bootstrap", async () => {
    const seed = await seedDeparture()
    await db.insert(people).values({
      id: "person-storefront-owner",
      firstName: "Personal",
      lastName: "Buyer",
      status: "active",
    })
    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      headers: {
        ...json({}).headers,
        "x-test-customer": "1",
        "x-test-buyer-kind": "personal",
      },
      body: JSON.stringify(bootstrapPayload(seed)),
    })
    expect(res.status).toBe(201)
    const session = (await res.json()).data.session
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, session.sessionId))
    expect(booking).toEqual(
      expect.objectContaining({ personId: "person-storefront-owner", organizationId: null }),
    )
  })

  // Compatibility bootstrap (issue voyant#1984): derive slot/price server-side
  // from the minimal `{ productId, departureId, pax, ... }` contract.
  it("compat-bootstraps a session from minimal product/departure input", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      ...json({
        productId: seed.product.id,
        departureId: seed.slot.id,
        optionUnitId: seed.unit.id,
        pax: 1,
        currency: "EUR",
        locale: "en",
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.currency).toBe("EUR")
    expect(body.data.session.status).toBe("on_hold")
    expect(body.data.session.checkoutCapability.actions).toContain("payment:start")
    // The server derived the price, so the quote is never stale.
    expect(body.data.repricing).toEqual(
      expect.objectContaining({ deltaAmountCents: 0, staleQuote: false }),
    )
    expect(body.data.repricing.current.totalSellAmountCents).toBe(50000)
    expect(body.data.session.items[0]).toEqual(
      expect.objectContaining({
        productId: seed.product.id,
        optionId: seed.option.id,
        optionUnitId: seed.unit.id,
      }),
    )
    expect(body.data.availability).toEqual(
      expect.objectContaining({
        departureId: seed.slot.id,
        slotId: seed.slot.id,
        productId: seed.product.id,
        remaining: 9,
      }),
    )
  })

  it("stamps the active business buyer on compatibility bootstrap", async () => {
    const seed = await seedDeparture()
    await db.insert(organizations).values({
      id: "org-storefront-owner",
      name: "Storefront Business Buyer",
      status: "active",
    })
    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      headers: {
        ...json({}).headers,
        "x-test-customer": "1",
        "x-test-buyer-kind": "business",
      },
      body: JSON.stringify({
        productId: seed.product.id,
        departureId: seed.slot.id,
        optionUnitId: seed.unit.id,
        pax: 1,
        currency: "EUR",
      }),
    })
    expect(res.status).toBe(201)
    const session = (await res.json()).data.session
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, session.sessionId))
    expect(booking).toEqual(
      expect.objectContaining({ personId: null, organizationId: "org-storefront-owner" }),
    )
  })

  it("rejects compat-bootstrap when the departure does not belong to the product", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      ...json({
        productId: "prod_someone_else",
        departureId: seed.slot.id,
        pax: 1,
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("PRODUCT_MISMATCH")
    expect(body.retryable).toBe(false)
  })

  it("returns DEPARTURE_NOT_FOUND for an unknown compat-bootstrap departure", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      ...json({
        productId: seed.product.id,
        departureId: "slot_missing",
        pax: 1,
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe("DEPARTURE_NOT_FOUND")
  })

  // An imported departure can carry an external id that is not the native
  // availability-slot id — `slotId` points at the real slot, and the caller's
  // external `departureId` is echoed back in the response.
  it("honors a compat-bootstrap slotId override distinct from departureId", async () => {
    const seed = await seedDeparture()

    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      ...json({
        productId: seed.product.id,
        departureId: "import_dep_external_42",
        slotId: seed.slot.id,
        optionUnitId: seed.unit.id,
        pax: 1,
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.session.status).toBe("on_hold")
    expect(body.data.repricing.current.totalSellAmountCents).toBe(50000)
    expect(body.data.availability).toEqual(
      expect.objectContaining({
        departureId: "import_dep_external_42",
        slotId: seed.slot.id,
        productId: seed.product.id,
      }),
    )
  })
})
