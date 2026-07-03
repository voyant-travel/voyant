import { describe, expect, it, vi } from "vitest"

import { cruiseCabinCategories, cruiseDecks, cruiseShips } from "../../src/schema-cabins.js"
import { cruiseInclusions, cruiseMedia } from "../../src/schema-content.js"
import { cruiseSailings, cruises } from "../../src/schema-core.js"
import { cruiseDays, cruiseSailingDays } from "../../src/schema-itinerary.js"
import { cruisePrices } from "../../src/schema-pricing.js"
import { getCruiseContent } from "../../src/service-content.js"
import { buildOwnedCruiseContent } from "../../src/service-content-owned.js"

describe("buildOwnedCruiseContent", () => {
  it("projects owned cruise rows into public CruiseContent", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [
          cruises,
          [
            {
              id: "cru_1",
              slug: "mediterranean-highlights",
              name: "Mediterranean Highlights",
              cruiseType: "ocean",
              lineSupplierId: "supp_line",
              defaultShipId: "ship_1",
              nights: 7,
              embarkPortFacilityId: "fac_rome",
              embarkPortCanonicalPlaceId: "ITROM",
              disembarkPortFacilityId: "fac_rome",
              disembarkPortCanonicalPlaceId: "ITROM",
              description: "Long description",
              shortDescription: "Short description",
              highlights: ["Rome round-trip"],
              inclusionsHtml: "<p>Meals included</p>",
              exclusionsHtml: "<p>Excursions extra</p>",
              heroImageUrl: "https://example.com/hero.jpg",
              status: "live",
              customerPaymentPolicy: { deposit: { percent: 25 } },
            },
          ],
        ],
        [
          cruiseSailings,
          [
            {
              id: "sail_1",
              cruiseId: "cru_1",
              shipId: "ship_1",
              departureDate: "2026-07-12",
              returnDate: "2026-07-19",
              embarkPortFacilityId: "fac_rome",
              embarkPortCanonicalPlaceId: "ITROM",
              disembarkPortFacilityId: "fac_rome",
              disembarkPortCanonicalPlaceId: "ITROM",
              salesStatus: "open",
              externalRefs: { externalId: "MED-2026-07-12" },
              customerPaymentPolicy: null,
            },
          ],
        ],
        [
          cruiseShips,
          [
            {
              id: "ship_1",
              name: "MV Voyant Explorer",
              shipType: "ocean",
              description: "Mid-size demo ship.",
              deckPlanUrl: "https://example.com/deck-plan.pdf",
              capacityGuests: 1840,
              deckCount: 12,
              yearBuilt: 2019,
              gallery: ["https://example.com/ship.jpg"],
            },
          ],
        ],
        [
          cruiseDecks,
          [
            {
              shipId: "ship_1",
              name: "Promenade",
              level: 5,
              planImageUrl: "https://example.com/deck-5.jpg",
            },
          ],
        ],
        [
          cruiseCabinCategories,
          [
            {
              id: "cab_1",
              shipId: "ship_1",
              code: "BAL",
              name: "Balcony Stateroom",
              roomType: "balcony",
              description: "Private balcony stateroom.",
              minOccupancy: 1,
              maxOccupancy: 2,
              squareFeet: "210.00",
              wheelchairAccessible: false,
              amenities: ["private balcony"],
              featureCodes: ["balcony"],
              bedConfigurations: ["queen"],
              accessibilityFeatures: [],
              viewType: "balcony",
              images: ["https://example.com/cabin.jpg"],
              floorplanImages: ["https://example.com/floorplan.jpg"],
              gradeCodes: ["BAL"],
              customerPaymentPolicy: null,
            },
          ],
        ],
        [
          cruiseDays,
          [
            {
              cruiseId: "cru_1",
              dayNumber: 1,
              title: "Rome",
              description: "Embark in Rome.",
              portFacilityId: "fac_rome",
              portCanonicalPlaceId: "ITROM",
              arrivalTime: null,
              departureTime: "17:00",
              isSeaDay: false,
            },
          ],
        ],
        [cruiseSailingDays, []],
        [
          cruisePrices,
          [
            {
              sailingId: "sail_1",
              pricePerPerson: "1299.00",
              currency: "EUR",
              availability: "available",
            },
          ],
        ],
        [
          cruiseMedia,
          [
            {
              cruiseId: "cru_1",
              sailingId: null,
              mediaType: "image",
              url: "https://example.com/cover.jpg",
              altText: "Ship at sea",
              sortOrder: 0,
              isCover: true,
              createdAt: new Date("2026-01-01"),
            },
          ],
        ],
        [
          cruiseInclusions,
          [
            {
              cruiseId: "cru_1",
              kind: "included",
              label: "Port charges",
              description: "Included in the fare.",
              sortOrder: 0,
            },
          ],
        ],
      ]),
    )

    const result = await buildOwnedCruiseContent(db, "cru_1", {
      preferredLocales: ["en-GB"],
    })

    expect(result?.servedLocale).toBe("und")
    expect(result?.matchKind).toBe("any")
    expect(result?.content.cruise).toMatchObject({
      id: "cru_1",
      name: "Mediterranean Highlights",
      hero_image_url: "https://example.com/cover.jpg",
      duration_nights: 7,
      embarkation_port: "ITROM",
    })
    expect(result?.content.ship).toMatchObject({
      id: "ship_1",
      name: "MV Voyant Explorer",
      deck_plans: [{ name: "Promenade", level: 5, image_url: "https://example.com/deck-5.jpg" }],
    })
    expect(result?.content.sailings).toEqual([
      expect.objectContaining({
        id: "sail_1",
        source_ref: "MED-2026-07-12",
        start_date: "2026-07-12",
        end_date: "2026-07-19",
        duration_nights: 7,
        lowest_price_cents: 129900,
        currency: "EUR",
        itinerary_stops: [
          expect.objectContaining({
            day_number: 1,
            date: "2026-07-12",
            port_name: "Rome",
          }),
        ],
      }),
    ])
    expect(result?.content.cabin_categories).toEqual([
      expect.objectContaining({
        id: "cab_1",
        code: "BAL",
        type: "balcony",
        inclusions: ["private balcony"],
      }),
    ])
    expect(result?.content.policies).toEqual(
      expect.arrayContaining([
        { kind: "supplier_notes", body: "<p>Meals included</p>" },
        { kind: "supplier_notes", body: "<p>Excursions extra</p>" },
        { kind: "supplier_notes", body: "Port charges\n\nIncluded in the fare." },
        expect.objectContaining({
          kind: "payment",
          body: "cruise payment policy",
          rules: { scope: "cruise", id: "cru_1", policy: { deposit: { percent: 25 } } },
        }),
      ]),
    )
  })
})

describe("getCruiseContent owned dispatch", () => {
  it("returns owned content before sourced-adapter resolution", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [
          cruises,
          [
            {
              id: "cru_1",
              name: "Owned Cruise",
              cruiseType: "river",
              lineSupplierId: null,
              defaultShipId: null,
              nights: 4,
              embarkPortFacilityId: null,
              embarkPortCanonicalPlaceId: null,
              disembarkPortFacilityId: null,
              disembarkPortCanonicalPlaceId: null,
              description: null,
              shortDescription: null,
              highlights: [],
              inclusionsHtml: null,
              exclusionsHtml: null,
              heroImageUrl: null,
              status: "live",
              customerPaymentPolicy: null,
            },
          ],
        ],
        [cruiseSailings, []],
        [cruiseMedia, []],
        [cruiseInclusions, []],
        [cruiseDays, []],
      ]),
    )
    const registry = {
      byKind: vi.fn(() => {
        throw new Error("registry should not be used for owned content")
      }),
      resolveByConnection: vi.fn(),
    }

    const result = await getCruiseContent(
      db,
      "cru_1",
      { preferredLocales: ["en-GB"] },
      { registry: registry as never },
    )

    expect(result?.source).toBe("owned")
    expect(result?.provenance).toEqual({ source_kind: "owned" })
    expect(result?.content.cruise.name).toBe("Owned Cruise")
    expect(registry.byKind).not.toHaveBeenCalled()
  })
})

function fakeDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => selectable(rowsByTable.get(table) ?? []),
    }),
  } as never
}

function selectable(rows: unknown[]) {
  const chain = {
    where: () => promiseChain(rows),
    orderBy: async () => rows,
    limit: async (limit: number) => rows.slice(0, limit),
    offset: () => chain,
  }
  return chain
}

type QueryPromise = Promise<unknown[]> & {
  orderBy: () => Promise<unknown[]>
  limit: (limit: number) => Promise<unknown[]>
  offset: () => QueryPromise
}

function promiseChain(rows: unknown[]): QueryPromise {
  const promise = Promise.resolve(rows) as QueryPromise
  promise.orderBy = async () => rows
  promise.limit = async (limit: number) => rows.slice(0, limit)
  promise.offset = () => promise
  return promise
}
