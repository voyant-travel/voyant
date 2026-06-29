import { describe, expect, it } from "vitest"

import { buildDemoCatalogProjection, buildDemoGetContentResult } from "./routes.js"
import type { CatalogDemoInventoryRow } from "./schema.js"

function futureIso(daysAhead: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysAhead)
  date.setUTCHours(9, 0, 0, 0)
  return date.toISOString()
}

function pastIso(daysAgo: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(9, 0, 0, 0)
  return date.toISOString()
}

function demoRow(overrides: Partial<CatalogDemoInventoryRow> = {}): CatalogDemoInventoryRow {
  const now = new Date("2026-06-29T12:00:00.000Z")
  return {
    id: "cdmi_demo_product",
    entityModule: "products",
    name: "Demo Product",
    description: "A demo product",
    priceCents: 12_500,
    currency: "EUR",
    available: 10,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe("buildDemoCatalogProjection", () => {
  it("emits scheduled browse fields from departure metadata", () => {
    const firstDeparture = futureIso(3)
    const secondDeparture = futureIso(5)
    const departureMonths = [...new Set([firstDeparture.slice(0, 7), secondDeparture.slice(0, 7)])]
    const projection = buildDemoCatalogProjection(
      demoRow({
        metadata: {
          country: "pt",
          departureCity: "Lisbon",
          durationDays: 1,
          heroImageUrl: "https://cdn.example/lisbon.jpg",
          departures: [
            {
              id: "past",
              starts_at: pastIso(1),
              status: "open",
              remaining: 4,
              lowest_price_cents: 9_900,
            },
            {
              id: "first",
              starts_at: firstDeparture,
              status: "open",
              remaining: 3,
              lowest_price_cents: 7_500,
            },
            {
              id: "sold-out",
              starts_at: futureIso(4),
              status: "sold_out",
              remaining: 0,
              lowest_price_cents: 6_000,
            },
            {
              id: "second",
              starts_at: secondDeparture,
              status: "open",
              remaining: 2,
              lowest_price_cents: 8_500,
            },
          ],
        },
      }),
    )

    expect(projection.fields).toMatchObject({
      supplyModel: "scheduled",
      durationDays: 1,
      countryCodes: ["PT"],
      departureCity: "Lisbon",
      priceFromAmountCents: 7_500,
      priceFromCurrency: "EUR",
      hasPricing: true,
      primaryMediaUrl: "https://cdn.example/lisbon.jpg",
      thumbnailUrl: "https://cdn.example/lisbon.jpg",
      coverMediaUrl: "https://cdn.example/lisbon.jpg",
      nextDepartureAt: firstDeparture,
      nextDepartureDate: firstDeparture.slice(0, 10),
      hasUpcomingDeparture: true,
      upcomingDepartureCount: 2,
      availableDeparturesCount: 2,
      departureDates: [firstDeparture.slice(0, 10), secondDeparture.slice(0, 10)],
      departureMonths,
      availableUnitsTotal: 5,
    })
  })

  it("keeps explicit dynamic products visible in package browse filters", () => {
    const projection = buildDemoCatalogProjection(
      demoRow({
        priceCents: 84_000,
        metadata: {
          supplyModel: "dynamic",
          countryCodes: ["pe", "bo"],
          durationDays: 5,
        },
      }),
    )

    expect(projection.fields).toMatchObject({
      supplyModel: "dynamic",
      durationDays: 5,
      countryCodes: ["PE", "BO"],
      priceFromAmountCents: 84_000,
      priceFromCurrency: "EUR",
      hasPricing: true,
      nextDepartureAt: null,
      nextDepartureDate: null,
      hasUpcomingDeparture: false,
      upcomingDepartureCount: 0,
      availableDeparturesCount: 0,
      departureDates: [],
      departureMonths: [],
      availableUnitsTotal: null,
    })
  })

  it("emits encoded sourced IDs and cruise browse fields for cruise rows", () => {
    const projection = buildDemoCatalogProjection(
      demoRow({
        id: "cdmi_demo_cruise",
        entityModule: "cruises",
        metadata: {
          country: "gr",
          departureCity: "Athens",
          durationDays: 8,
          cruiseLine: "Demo Cruises",
          shipName: "Voyant Star",
          embarkationPort: "Piraeus",
          disembarkationPort: "Santorini",
        },
      }),
    )

    expect(projection.entity_id).toMatch(/^crus_sr_/)
    expect(projection.provenance.source_ref).toBe("cdmi_demo_cruise")
    expect(projection.fields).toMatchObject({
      id: projection.entity_id,
      cruiseLine: "Demo Cruises",
      shipName: "Voyant Star",
      durationNights: 7,
      embarkationPort: "Piraeus",
      disembarkationPort: "Santorini",
      countryCodes: ["GR"],
    })
  })

  it("emits accommodation browse fields without rewriting the room entity ID", () => {
    const projection = buildDemoCatalogProjection(
      demoRow({
        id: "cdmi_demo_hotel",
        entityModule: "accommodations",
        name: "Demo Hotel",
        metadata: {
          brand: "Demo Stays",
          city: "Porto",
          country: "pt",
          starRating: 4,
          roomTypeName: "River view room",
        },
      }),
    )

    expect(projection.entity_id).toBe("cdmi_demo_hotel")
    expect(projection.fields).toMatchObject({
      id: "cdmi_demo_hotel",
      hotelName: "Demo Hotel",
      brand: "Demo Stays",
      city: "Porto",
      country: "pt",
      starRating: 4,
      roomTypeName: "River view room",
    })
  })
})

describe("buildDemoGetContentResult", () => {
  it("returns cruises/v1 content for cruise rows", () => {
    const row = demoRow({
      id: "cdmi_demo_cruise",
      entityModule: "cruises",
      metadata: {
        heroImageUrl: "https://cdn.example/cruise.jpg",
        cruiseLine: "Demo Cruises",
        shipName: "Voyant Star",
        departureCity: "Athens",
        departures: [
          {
            id: "sailing_1",
            starts_at: "2026-09-01T09:00:00.000Z",
            ends_at: "2026-09-08T09:00:00.000Z",
            status: "open",
            lowest_price_cents: 110_000,
          },
        ],
      },
    })
    const projection = buildDemoCatalogProjection(row)
    const result = buildDemoGetContentResult(row, {
      entity_module: "cruises",
      entity_id: projection.entity_id,
      locale: "en-GB",
    })
    const content = result.content as {
      cruise: { name: string; cruise_line: string | null }
      sailings: Array<{ start_date: string }>
      ship: { name: string } | null
    }

    expect(result.entity_module).toBe("cruises")
    expect(result.entity_id).toBe(projection.entity_id)
    expect(result.source_ref).toBe("cdmi_demo_cruise")
    expect(result.content_schema_version).toBe("cruises/v1")
    expect(content.cruise).toMatchObject({ name: "Demo Product", cruise_line: "Demo Cruises" })
    expect(content.ship).toMatchObject({ name: "Voyant Star" })
    expect(content.sailings[0]?.start_date).toBe("2026-09-01")
  })

  it("returns accommodations/v1 content for accommodation rows", () => {
    const row = demoRow({
      id: "cdmi_demo_hotel",
      entityModule: "accommodations",
      name: "Demo Hotel",
      description: "A demo hotel",
      metadata: {
        heroImageUrl: "https://cdn.example/hotel.jpg",
        city: "Porto",
        country: "PT",
        starRating: 4,
        amenities: ["Pool", "Wi-Fi"],
      },
    })
    const result = buildDemoGetContentResult(row, {
      entity_module: "accommodations",
      entity_id: row.id,
      locale: "en-GB",
    })
    const content = result.content as {
      hotel: { name: string; city: string | null; star_rating: number | null }
      room_types: Array<{ id: string; name: string }>
      rate_plans: Array<{ applies_to_room_type_ids: string[] }>
      amenities: Array<{ name: string }>
    }

    expect(result.entity_module).toBe("accommodations")
    expect(result.content_schema_version).toBe("accommodations/v1")
    expect(content.hotel).toMatchObject({ name: "Demo Hotel", city: "Porto", star_rating: 4 })
    expect(content.room_types[0]).toMatchObject({ id: "room_standard", name: "Standard room" })
    expect(content.rate_plans[0]?.applies_to_room_type_ids).toEqual(["room_standard"])
    expect(content.amenities.map((amenity) => amenity.name)).toEqual(["Pool", "Wi-Fi"])
  })
})
