import { describe, expect, it } from "vitest"

import { buildDemoCatalogProjection } from "./routes.js"
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
})
