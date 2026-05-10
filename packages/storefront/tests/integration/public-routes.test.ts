import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { productExtras } from "@voyantjs/extras/schema"
import {
  extraPriceRules,
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
} from "@voyantjs/pricing/schema"
import {
  optionUnits,
  productDayServices,
  productDays,
  productItineraries,
  productLocations,
  productMedia,
  productOptions,
  products,
} from "@voyantjs/products/schema"
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

describe.skipIf(!DB_AVAILABLE)("Storefront public routes", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("returns public departures for a product", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Delta Danube Cruise",
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
        name: "Standard Cabin",
        status: "active",
        isDefault: true,
      })
      .returning()

    const [_defaultItinerary] = await db
      .insert(productItineraries)
      .values({
        productId: product.id,
        name: "Main itinerary",
        isDefault: true,
      })
      .returning()

    const [unit] = await db
      .insert(optionUnits)
      .values({
        optionId: option.id,
        name: "Double Cabin",
        unitType: "room",
        occupancyMin: 2,
        occupancyMax: 2,
        isHidden: false,
      })
      .returning()

    await db.insert(productLocations).values({
      productId: product.id,
      locationType: "meeting_point",
      title: "Bucharest Airport",
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

    const [rule] = await db
      .insert(optionPriceRules)
      .values({
        productId: product.id,
        optionId: option.id,
        priceCatalogId: catalog.id,
        name: "Cruise public rate",
        pricingMode: "per_person",
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

    const [startTime] = await db
      .insert(availabilityStartTimes)
      .values({
        productId: product.id,
        optionId: option.id,
        label: "Departure day",
        startTimeLocal: "08:30",
        durationMinutes: 480,
        active: true,
      })
      .returning()

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        itineraryId: defaultItinerary.id,
        optionId: option.id,
        startTimeId: startTime.id,
        dateLocal: "2026-08-01",
        startsAt: new Date("2026-08-01T05:30:00.000Z"),
        endsAt: new Date("2026-08-01T13:30:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        remainingPax: 12,
        initialPax: 24,
        nights: 7,
        days: 8,
      })
      .returning()

    const listRes = await app.request(`/products/${product.id}/departures`)
    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toEqual({
      data: [
        {
          id: slot.id,
          productId: product.id,
          itineraryId: defaultItinerary.id,
          optionId: option.id,
          dateLocal: "2026-08-01",
          startAt: "2026-08-01T05:30:00.000Z",
          endAt: "2026-08-01T13:30:00.000Z",
          timezone: "Europe/Bucharest",
          startTime: {
            id: startTime.id,
            label: "Departure day",
            startTimeLocal: "08:30",
            durationMinutes: 480,
          },
          meetingPoint: "Bucharest Airport",
          capacity: 24,
          remaining: 12,
          departureStatus: "open",
          nights: 7,
          days: 8,
          ratePlans: [
            {
              id: rule.id,
              active: true,
              name: "Cruise public rate",
              pricingModel: "per_room_person",
              basePrices: [],
              roomPrices: [
                {
                  amount: 1200,
                  currencyCode: "EUR",
                  roomType: {
                    id: unit.id,
                    name: "Double Cabin",
                    occupancy: {
                      adultsMin: 2,
                      adultsMax: 2,
                      childrenMax: 0,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    })

    const detailRes = await app.request(`/departures/${slot.id}`)
    expect(detailRes.status).toBe(200)
    expect((await detailRes.json()).data.id).toBe(slot.id)

    const availabilityRes = await app.request(
      `/products/${product.id}/availability?dateFrom=2026-08-01`,
    )
    expect(availabilityRes.status).toBe(200)
    expect(await availabilityRes.json()).toEqual({
      data: {
        productId: product.id,
        availabilityState: "available",
        counts: {
          total: 1,
          open: 1,
          closed: 0,
          soldOut: 0,
          cancelled: 0,
          onRequest: 0,
          pastCutoff: 0,
          tooEarly: 0,
          available: 1,
        },
        departures: [
          {
            id: slot.id,
            productId: product.id,
            optionId: option.id,
            dateLocal: "2026-08-01",
            startAt: "2026-08-01T05:30:00.000Z",
            endAt: "2026-08-01T13:30:00.000Z",
            timezone: "Europe/Bucharest",
            status: "open",
            availabilityState: "available",
            capacity: 24,
            remaining: 12,
            pastCutoff: false,
            tooEarly: false,
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      },
    })
  })

  it("returns a departure price preview with extras", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "City break",
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

    const [_defaultItinerary] = await db
      .insert(productItineraries)
      .values({
        productId: product.id,
        name: "Main itinerary",
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
        name: "Standard rate",
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })
      .returning()

    await db.insert(optionUnitPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      unitId: adultUnit.id,
      pricingMode: "per_unit",
      sellAmountCents: 30000,
      active: true,
    })

    const [extra] = await db
      .insert(productExtras)
      .values({
        productId: product.id,
        name: "Airport transfer",
        pricingMode: "per_booking",
        active: true,
      })
      .returning()

    await db.insert(extraPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      productExtraId: extra.id,
      pricingMode: "per_booking",
      sellAmountCents: 1500,
      active: true,
    })

    const [slot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        optionId: option.id,
        dateLocal: "2026-06-15",
        startsAt: new Date("2026-06-15T08:00:00.000Z"),
        endsAt: new Date("2026-06-15T10:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        remainingPax: 10,
      })
      .returning()

    const res = await app.request(`/departures/${slot.id}/price`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pax: { adults: 2, children: 0, infants: 0 },
        extras: [{ extraId: extra.id, quantity: 1 }],
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: {
        departureId: slot.id,
        productId: product.id,
        optionId: option.id,
        currencyCode: "EUR",
        basePrice: 600,
        taxAmount: 0,
        total: 615,
        notes: null,
        lineItems: [
          {
            name: "Standard · Adult",
            total: 600,
            quantity: 2,
            unitPrice: 300,
          },
          {
            name: "Airport transfer",
            total: 15,
            quantity: 1,
            unitPrice: 15,
          },
        ],
      },
    })
  })

  it("returns storefront extensions and itinerary content", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Island hopping",
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
        name: "Explorer",
        status: "active",
        isDefault: true,
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
        name: "Explorer rate",
        pricingMode: "per_person",
        isDefault: true,
        active: true,
      })
      .returning()

    const [extra] = await db
      .insert(productExtras)
      .values({
        productId: product.id,
        name: "Snorkeling pack",
        description: "Mask, fins, and guided reef stop.",
        selectionType: "optional",
        pricingMode: "per_person",
        pricedPerPerson: true,
        metadata: {
          refProductId: "prod_related_123",
          thumbUrl: "https://cdn.example.com/snorkel-thumb.jpg",
          media: [
            {
              url: "https://cdn.example.com/snorkel-1.jpg",
              alt: "Snorkeling gear",
            },
          ],
        },
      })
      .returning()

    await db.insert(extraPriceRules).values({
      optionPriceRuleId: rule.id,
      optionId: option.id,
      productExtraId: extra.id,
      pricingMode: "per_person",
      sellAmountCents: 4500,
      active: true,
    })

    const [defaultItinerary] = await db
      .insert(productItineraries)
      .values({
        productId: product.id,
        name: "Main itinerary",
        isDefault: true,
      })
      .returning()

    const [variantItinerary] = await db
      .insert(productItineraries)
      .values({
        productId: product.id,
        name: "Island variant",
        isDefault: false,
        sortOrder: 1,
      })
      .returning()

    const [dayOne] = await db
      .insert(productDays)
      .values({
        itineraryId: defaultItinerary.id,
        dayNumber: 1,
        title: "Arrival",
        description: "Transfer and welcome dinner.",
      })
      .returning()

    const [variantDay] = await db
      .insert(productDays)
      .values({
        itineraryId: variantItinerary.id,
        dayNumber: 1,
        title: "Island loop",
        description: "Variant day content.",
      })
      .returning()

    const [service] = await db
      .insert(productDayServices)
      .values({
        dayId: dayOne.id,
        serviceType: "experience",
        name: "Sunset cruise",
        description: "Harbor sail at golden hour.",
        costCurrency: "EUR",
        costAmountCents: 0,
        quantity: 1,
        sortOrder: 1,
      })
      .returning()

    await db.insert(productMedia).values({
      productId: product.id,
      dayId: dayOne.id,
      mediaType: "image",
      name: "Arrival day cover",
      url: "https://cdn.example.com/day-1.jpg",
      isCover: true,
    })

    const [variantSlot] = await db
      .insert(availabilitySlots)
      .values({
        productId: product.id,
        itineraryId: variantItinerary.id,
        optionId: option.id,
        dateLocal: "2026-09-01",
        startsAt: new Date("2026-09-01T08:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        remainingPax: 8,
      })
      .returning()

    const extensionsRes = await app.request(
      `/products/${product.id}/extensions?optionId=${option.id}`,
    )
    expect(extensionsRes.status).toBe(200)
    expect(await extensionsRes.json()).toEqual({
      data: {
        extensions: [
          {
            id: extra.id,
            name: "Snorkeling pack",
            label: "Snorkeling pack",
            required: false,
            selectable: true,
            hasOptions: false,
            refProductId: "prod_related_123",
            thumb: "https://cdn.example.com/snorkel-thumb.jpg",
            pricePerPerson: 45,
            currencyCode: "EUR",
            pricingMode: "per_person",
            defaultQuantity: null,
            minQuantity: null,
            maxQuantity: null,
          },
        ],
        items: [
          {
            id: extra.id,
            name: "Snorkeling pack",
            label: "Snorkeling pack",
            required: false,
            selectable: true,
            hasOptions: false,
            refProductId: "prod_related_123",
            thumb: "https://cdn.example.com/snorkel-thumb.jpg",
            pricePerPerson: 45,
            currencyCode: "EUR",
            pricingMode: "per_person",
            defaultQuantity: null,
            minQuantity: null,
            maxQuantity: null,
          },
        ],
        details: {
          [extra.id]: {
            description: "Mask, fins, and guided reef stop.",
            media: [
              {
                url: "https://cdn.example.com/snorkel-1.jpg",
                alt: "Snorkeling gear",
              },
            ],
          },
        },
        currencyCode: "EUR",
      },
    })

    const itineraryRes = await app.request(
      `/products/${product.id}/departures/dep_compat_123/itinerary`,
    )
    expect(itineraryRes.status).toBe(200)
    expect(await itineraryRes.json()).toEqual({
      data: {
        id: "dep_compat_123",
        itineraryId: defaultItinerary.id,
        days: [
          {
            id: dayOne.id,
            title: "Arrival",
            description: "Transfer and welcome dinner.",
            thumbnail: {
              url: "https://cdn.example.com/day-1.jpg",
            },
            segments: [
              {
                id: service.id,
                title: "Sunset cruise",
                description: "Harbor sail at golden hour.",
              },
            ],
          },
        ],
      },
    })

    const variantItineraryRes = await app.request(
      `/products/${product.id}/departures/${variantSlot.id}/itinerary`,
    )
    expect(variantItineraryRes.status).toBe(200)
    expect(await variantItineraryRes.json()).toEqual({
      data: {
        id: variantSlot.id,
        itineraryId: variantItinerary.id,
        days: [
          {
            id: variantDay.id,
            title: "Island loop",
            description: "Variant day content.",
            thumbnail: null,
            segments: [],
          },
        ],
      },
    })
  })
})
