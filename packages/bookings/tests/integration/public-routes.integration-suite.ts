// agent-quality: file-size exception -- owner: bookings; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { handleApiError } from "@voyant-travel/hono"
import { asc, eq } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { optionUnits, productOptions, products } from "../../../inventory/src/schema.js"

import { availabilitySlotsRef } from "../../src/availability-ref.js"
import {
  optionPriceRulesRef,
  optionUnitPriceRulesRef,
  priceCatalogsRef,
} from "../../src/pricing-ref.js"
import { BOOKING_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { publicBookingRoutes } from "../../src/routes-public.js"
import {
  bookingDocuments,
  bookingFulfillments,
  bookingItems,
  bookings,
  bookingTravelers,
} from "../../src/schema.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const ORIGINAL_CHECKOUT_CAPABILITY_SECRET = process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

function travelerPersonId(traveler: {
  firstName: string
  lastName: string
  email?: string | null
}) {
  return `person:${traveler.email ?? `${traveler.firstName}:${traveler.lastName}`}`
}

describe.skipIf(!DB_AVAILABLE)("Public booking routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = "public-booking-route-test-secret-32"
    const { createTestDb } = await import("@voyant-travel/db/test-utils")

    db = createTestDb()
    app = new Hono()
      .onError(handleApiError)
      .use("*", async (c, next) => {
        c.set("db" as never, db)
        c.set("userId" as never, "public-test-user")
        c.set("container" as never, {
          resolve: (key: string) => {
            if (key !== BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) {
              return undefined
            }

            return {
              resolveTravelerPerson: async (
                _db: unknown,
                traveler: { firstName: string; lastName: string; email?: string | null },
              ) => travelerPersonId(traveler),
            }
          },
        })
        await next()
      })
      .route("/", publicBookingRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    process.env.VOYANT_CHECKOUT_CAPABILITY_SECRET = ORIGINAL_CHECKOUT_CAPABILITY_SECRET
    await closeTestDb()
  })

  function capabilityHeaders(session: { checkoutCapability: { token: string } }): HeadersInit {
    return { "X-Voyant-Checkout-Capability": session.checkoutCapability.token }
  }

  async function seedSlot(overrides: Record<string, unknown> = {}) {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId: "prod_public_booking",
        optionId: "opt_public_booking",
        dateLocal: "2026-06-01",
        startsAt: new Date("2026-06-01T09:00:00.000Z"),
        endsAt: new Date("2026-06-01T11:00:00.000Z"),
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

    return slot
  }

  async function seedPublicPricing(productId: string, optionId: string) {
    const [product] = await db
      .insert(products)
      .values({
        id: productId,
        name: "Public roomed circuit",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [option] = await db
      .insert(productOptions)
      .values({
        id: optionId,
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
        name: "Double room",
        unitType: "room",
        occupancyMin: 2,
        occupancyMax: 2,
        isHidden: false,
      })
      .returning()

    const [catalog] = await db
      .insert(priceCatalogsRef)
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
      .insert(optionPriceRulesRef)
      .values({
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Room rule",
        pricingMode: "per_booking",
        baseSellAmountCents: 50000,
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRulesRef).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: unit.id,
      pricingMode: "per_booking",
      sellAmountCents: 50000,
      active: true,
    })

    return { product, option, unit, catalog }
  }

  it("creates a public booking session from a storefront reservation request", async () => {
    const slot = await seedSlot()
    const pricing = await seedPublicPricing(slot.productId, slot.optionId)

    const res = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Danube tour",
            availabilitySlotId: slot.id,
            quantity: 2,
            totalSellAmountCents: 24000,
            productId: slot.productId,
            optionId: slot.optionId,
            optionUnitId: pricing.unit.id,
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
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe("on_hold")
    expect(body.data.checkoutCapability.actions).toContain("session:update")
    expect(body.data.bookingNumber).toMatch(/^BK-\d{4}-\d{6}$/)
    expect(body.data.travelers).toHaveLength(1)
    expect(body.data.allocations).toHaveLength(1)
    expect(body.data.checklist.readyForConfirmation).toBe(true)

    const [slotAfter] = await db
      .select()
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))

    expect(slotAfter?.remainingPax).toBe(8)

    const [item] = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, body.data.sessionId))

    expect(item).toEqual(
      expect.objectContaining({
        productNameSnapshot: pricing.product.name,
        optionNameSnapshot: pricing.option.name,
        unitNameSnapshot: pricing.unit.name,
        availabilitySlotId: slot.id,
      }),
    )
    expect(item?.departureLabelSnapshot).toContain("2026")
  })

  it("updates a booking session contact state and derives pax from traveler participants", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Prague city pass",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 12000,
          },
        ],
        travelers: [
          {
            firstName: "Mihai",
            lastName: "Ionescu",
            email: "mihai@example.com",
            isPrimary: true,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const res = await app.request(`/sessions/${session.sessionId}`, {
      method: "PATCH",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        communicationLanguage: "ro",
        travelers: [
          {
            id: session.travelers[0].id,
            firstName: "Mihai",
            lastName: "Ionescu",
            email: "mihai@example.com",
            isPrimary: true,
          },
          {
            firstName: "Ioana",
            lastName: "Ionescu",
            email: "ioana@example.com",
            travelerCategory: "adult",
          },
        ],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.communicationLanguage).toBe("ro")
    expect(body.data.travelers).toHaveLength(2)
    expect(body.data.pax).toBe(2)
  })

  it("confirms a public booking session and returns overview lookup by booking number and email", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Lisbon food tour",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 15000,
          },
        ],
        travelers: [
          {
            firstName: "Elena",
            lastName: "Marin",
            email: "elena@example.com",
            isPrimary: true,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const confirmRes = await app.request(`/sessions/${session.sessionId}/confirm`, {
      method: "POST",
      ...json({}),
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
    })

    expect(confirmRes.status).toBe(200)
    const confirmed = (await confirmRes.json()).data
    expect(confirmed.status).toBe("confirmed")

    await db.insert(bookingDocuments).values({
      bookingId: session.sessionId,
      participantId: session.travelers[0].id,
      type: "other",
      fileName: "service-voucher.pdf",
      fileUrl: "https://example.com/service-voucher.pdf",
    })

    await db.insert(bookingFulfillments).values({
      bookingId: session.sessionId,
      bookingItemId: session.items[0].id,
      participantId: session.travelers[0].id,
      fulfillmentType: "service_voucher",
      deliveryChannel: "download",
      status: "issued",
      artifactUrl: "https://example.com/artifact.pdf",
    })

    const overviewRes = await app.request(
      `/overview?bookingNumber=${encodeURIComponent(session.bookingNumber)}&email=${encodeURIComponent("elena@example.com")}`,
      { method: "GET" },
    )

    expect(overviewRes.status).toBe(200)
    const overview = (await overviewRes.json()).data
    expect(overview.status).toBe("confirmed")
    expect(overview.documents).toHaveLength(1)
    expect(overview.fulfillments).toHaveLength(1)
    expect(overview.travelers[0]?.firstName).toBe("Elena")

    const rateLimitStore = new Map<string, string>()
    const rateLimitEnv = {
      GUEST_BOOKING_LOOKUP_LIMIT_PER_MINUTE: "1",
      RATE_LIMIT: {
        get: async (key: string) => rateLimitStore.get(key) ?? null,
        put: async (key: string, value: string) => {
          rateLimitStore.set(key, value)
        },
      },
    }
    const limitedLookupPath = `/overview?bookingNumber=${encodeURIComponent(session.bookingNumber)}&email=${encodeURIComponent("elena@example.com")}`

    expect((await app.request(limitedLookupPath, { method: "GET" }, rateLimitEnv)).status).toBe(200)
    expect((await app.request(limitedLookupPath, { method: "GET" }, rateLimitEnv)).status).toBe(429)
  })

  it("issues guest booking access after booking code and email lookup", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Porto river cruise",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 12000,
          },
        ],
        travelers: [
          {
            firstName: "Ana",
            lastName: "Pop",
            email: "ana@example.com",
            isPrimary: true,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const confirmRes = await app.request(`/sessions/${session.sessionId}/confirm`, {
      method: "POST",
      ...json({}),
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
    })

    expect(confirmRes.status).toBe(200)

    const deniedRes = await app.request(
      `/overview?bookingCode=${encodeURIComponent(session.bookingNumber)}`,
      { method: "GET" },
    )
    expect(deniedRes.status).toBe(401)
    const deniedBody = await deniedRes.json()

    const missingDeniedRes = await app.request("/overview?bookingCode=BK-2026-000000", {
      method: "GET",
    })
    expect(missingDeniedRes.status).toBe(401)
    const missingDeniedBody = await missingDeniedRes.json()
    expect(missingDeniedBody.error).toBe(deniedBody.error)
    expect(missingDeniedBody.code).toBe(deniedBody.code)

    const badLookupRes = await app.request("/guest-lookup", {
      method: "POST",
      ...json({ bookingCode: session.bookingNumber, email: "other@example.com" }),
    })
    expect(badLookupRes.status).toBe(404)

    const lookupRes = await app.request("/guest-lookup", {
      method: "POST",
      ...json({ bookingCode: session.bookingNumber, email: "ANA@example.com" }),
    })

    expect(lookupRes.status).toBe(200)
    expect(lookupRes.headers.get("Set-Cookie")).toContain("voyant_guest_booking=")

    const lookup = (await lookupRes.json()).data
    expect(lookup.overview.bookingId).toBe(session.sessionId)
    expect(lookup.guestBookingAccess.actions).toContain("overview:read")

    const overviewRes = await app.request(
      `/overview?bookingCode=${encodeURIComponent(session.bookingNumber)}`,
      {
        method: "GET",
        headers: { "X-Voyant-Guest-Booking-Access": lookup.guestBookingAccess.token },
      },
    )

    expect(overviewRes.status).toBe(200)
    const overview = (await overviewRes.json()).data
    expect(overview.bookingId).toBe(session.sessionId)
    expect(overview.travelers[0]?.firstName).toBe("Ana")
  })

  it("persists wizard session state and includes it in session reads", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Cluj escape",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 18000,
            productId: slot.productId,
            optionId: slot.optionId,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const stateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          selections: [{ itemId: session.items[0].id, optionUnitId: "optu_room_double" }],
        },
      }),
    })

    expect(stateRes.status).toBe(200)
    const stateBody = await stateRes.json()
    expect(stateBody.data.currentStep).toBe("rooms")
    expect(stateBody.data.version).toBe(1)

    const sessionRes = await app.request(`/sessions/${session.sessionId}`, {
      method: "GET",
      headers: capabilityHeaders(session),
    })
    expect(sessionRes.status).toBe(200)
    const sessionBody = await sessionRes.json()
    expect(sessionBody.data.state.currentStep).toBe("rooms")
    expect(sessionBody.data.state.completedSteps).toEqual(["travelers"])
  })

  it("materializes wizard travelers into booking traveler rows", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Brasov weekend",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 18000,
            productId: slot.productId,
            optionId: slot.optionId,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const stateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            travelers: {
              travelers: [
                {
                  firstName: "Ana",
                  lastName: "Popescu",
                  email: "ana@example.com",
                  isPrimary: true,
                  travelerCategory: "adult",
                },
                {
                  firstName: "Bogdan",
                  lastName: "Popescu",
                  phone: "+40700111222",
                  participantType: "occupant",
                  travelerCategory: "adult",
                },
              ],
            },
          },
        },
      }),
    })

    expect(stateRes.status).toBe(200)

    const rows = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, session.sessionId))
      .orderBy(asc(bookingTravelers.createdAt))

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(
      expect.objectContaining({
        firstName: "Ana",
        lastName: "Popescu",
        email: "ana@example.com",
        isPrimary: true,
        participantType: "traveler",
        personId: travelerPersonId({
          firstName: "Ana",
          lastName: "Popescu",
          email: "ana@example.com",
        }),
      }),
    )
    expect(rows[1]).toEqual(
      expect.objectContaining({
        firstName: "Bogdan",
        lastName: "Popescu",
        phone: "+40700111222",
        participantType: "occupant",
        personId: travelerPersonId({
          firstName: "Bogdan",
          lastName: "Popescu",
        }),
      }),
    )

    const sessionRes = await app.request(`/sessions/${session.sessionId}`, {
      method: "GET",
      headers: capabilityHeaders(session),
    })
    expect(sessionRes.status).toBe(200)
    const sessionBody = await sessionRes.json()
    expect(sessionBody.data.travelers).toHaveLength(2)
    expect(sessionBody.data.checklist.hasTravelers).toBe(true)
    expect(sessionBody.data.pax).toBe(2)

    const reorderRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            travelers: {
              travelers: [
                {
                  firstName: "Bogdan",
                  lastName: "Popescu",
                  phone: "+40700111222",
                  participantType: "occupant",
                  travelerCategory: "adult",
                },
                {
                  firstName: "Ana",
                  lastName: "Popescu",
                  email: "ana@example.com",
                  isPrimary: true,
                  travelerCategory: "adult",
                },
              ],
            },
          },
        },
      }),
    })

    expect(reorderRes.status).toBe(200)

    const reorderedRows = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, session.sessionId))
      .orderBy(asc(bookingTravelers.createdAt))

    expect(reorderedRows).toHaveLength(2)
    expect(reorderedRows[0]).toEqual(
      expect.objectContaining({
        id: rows[0].id,
        firstName: "Bogdan",
        personId: travelerPersonId({
          firstName: "Bogdan",
          lastName: "Popescu",
        }),
      }),
    )
    expect(reorderedRows[1]).toEqual(
      expect.objectContaining({
        id: rows[1].id,
        firstName: "Ana",
        personId: travelerPersonId({
          firstName: "Ana",
          lastName: "Popescu",
          email: "ana@example.com",
        }),
      }),
    )

    const updateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            travelers: {
              travelers: [
                {
                  id: reorderedRows[1].id,
                  firstName: "Ana Maria",
                  lastName: "Popescu",
                  email: "ana@example.com",
                  phone: "+40700999888",
                  isPrimary: true,
                  travelerCategory: "adult",
                },
              ],
            },
          },
        },
      }),
    })

    expect(updateRes.status).toBe(200)

    const updatedRows = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, session.sessionId))
      .orderBy(asc(bookingTravelers.createdAt))

    expect(updatedRows).toHaveLength(1)
    expect(updatedRows[0]).toEqual(
      expect.objectContaining({
        id: reorderedRows[1].id,
        firstName: "Ana Maria",
        phone: "+40700999888",
        participantType: "traveler",
        personId: travelerPersonId({
          firstName: "Ana",
          lastName: "Popescu",
          email: "ana@example.com",
        }),
      }),
    )
  })

  it("preserves a position-matched traveler person link when state omits row ids", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Sibiu weekend",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 18000,
            productId: slot.productId,
            optionId: slot.optionId,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const firstStateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            travelers: {
              travelers: [
                {
                  firstName: "Companion",
                  lastName: "One",
                  travelerCategory: "adult",
                },
              ],
            },
          },
        },
      }),
    })

    expect(firstStateRes.status).toBe(200)

    const [firstTraveler] = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, session.sessionId))

    expect(firstTraveler?.personId).toBe(
      travelerPersonId({ firstName: "Companion", lastName: "One" }),
    )

    const secondStateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "rooms",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            travelers: {
              travelers: [
                {
                  firstName: "Companion",
                  lastName: "Edited",
                  travelerCategory: "adult",
                },
              ],
            },
          },
        },
      }),
    })

    expect(secondStateRes.status).toBe(200)

    const [updatedTraveler] = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, session.sessionId))

    expect(updatedTraveler).toEqual(
      expect.objectContaining({
        id: firstTraveler?.id,
        firstName: "Companion",
        lastName: "Edited",
        personId: firstTraveler?.personId,
      }),
    )
  })

  it("syncs billing contact from wizard state into the booking snapshot", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Timisoara break",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 18000,
            productId: slot.productId,
            optionId: slot.optionId,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const stateRes = await app.request(`/sessions/${session.sessionId}/state`, {
      method: "PUT",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        currentStep: "billing",
        completedSteps: ["travelers"],
        payload: {
          stepData: {
            billing: {
              billing: {
                firstName: "Anca",
                lastName: "Ionescu",
                email: "anca@example.com",
                phone: "+40999888777",
                country: "FR",
                state: "Ile-de-France",
                city: "Paris",
                addressLine1: "Rue de Rivoli 22",
                addressLine2: "Etage 3",
                postalCode: "75001",
              },
            },
          },
        },
      }),
    })

    expect(stateRes.status).toBe(200)

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, session.sessionId))

    expect(booking).toEqual(
      expect.objectContaining({
        contactFirstName: "Anca",
        contactLastName: "Ionescu",
        contactEmail: "anca@example.com",
        contactPhone: "+40999888777",
        contactCountry: "FR",
        contactRegion: "Ile-de-France",
        contactCity: "Paris",
        contactAddressLine1: "Rue de Rivoli 22",
        contactAddressLine2: "Etage 3",
        contactPostalCode: "75001",
      }),
    )
  })

  it("reprices a room selection and can apply the priced selection back onto the session", async () => {
    const slot = await seedSlot({
      productId: "prod_room_booking",
      optionId: "opt_room_booking",
    })
    const pricing = await seedPublicPricing(slot.productId, slot.optionId)

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        pax: 2,
        items: [
          {
            title: "Bucharest stay",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 0,
            productId: slot.productId,
            optionId: slot.optionId,
          },
        ],
        travelers: [
          {
            firstName: "Radu",
            lastName: "Pop",
            email: "radu@example.com",
            isPrimary: true,
          },
          {
            firstName: "Maria",
            lastName: "Pop",
            email: "maria@example.com",
          },
        ],
      }),
    })

    const session = (await createRes.json()).data

    const repriceRes = await app.request(`/sessions/${session.sessionId}/reprice`, {
      method: "POST",
      headers: { ...json({}).headers, ...capabilityHeaders(session) },
      body: JSON.stringify({
        applyToSession: true,
        selections: [
          {
            itemId: session.items[0].id,
            optionUnitId: pricing.unit.id,
            quantity: 1,
          },
        ],
      }),
    })

    expect(repriceRes.status).toBe(200)
    const body = await repriceRes.json()
    expect(body.data.pricing.items[0]?.optionUnitId).toBe(pricing.unit.id)
    expect(body.data.pricing.items[0]?.totalSellAmountCents).toBe(50000)
    expect(body.data.session.items[0]?.optionUnitId).toBe(pricing.unit.id)
    expect(body.data.session.sellAmountCents).toBe(50000)
  })

  it("rejects PII-bearing session reads without a checkout capability", async () => {
    const slot = await seedSlot()

    const createRes = await app.request("/sessions", {
      method: "POST",
      ...json({
        sellCurrency: "EUR",
        items: [
          {
            title: "Capability check",
            availabilitySlotId: slot.id,
            quantity: 1,
            totalSellAmountCents: 12000,
          },
        ],
      }),
    })

    const session = (await createRes.json()).data
    const res = await app.request(`/sessions/${session.sessionId}`, { method: "GET" })

    expect(res.status).toBe(401)
  })
})
