import { createFieldPolicyRegistry } from "@voyant-travel/catalog/contract"
import { resolveOverlay } from "@voyant-travel/catalog/overlay/resolver"
import { describe, expect, it } from "vitest"

import { cruiseCatalogPolicy } from "../../src/catalog-policy.js"
import { cruiseSailings, cruises } from "../../src/schema-core.js"
import { cruisePrices } from "../../src/schema-pricing.js"
import {
  createCruiseDocumentBuilder,
  cruiseProvenance,
  cruiseRowToProjection,
} from "../../src/service-catalog-plane.js"

const sampleRow = {
  id: "crse_abc",
  slug: "rhine-discovery-15d",
  name: "15-Day Rhine Discovery",
  cruiseType: "river" as const,
  lineSupplierId: "supp_viking",
  defaultShipId: "ship_eir",
  nights: 14,
  embarkPortFacilityId: "fac_ams",
  embarkPortCanonicalPlaceId: "NLAMS",
  disembarkPortFacilityId: "fac_bsl",
  disembarkPortCanonicalPlaceId: "CHBSL",
  description: "Source description",
  shortDescription: "Short blurb",
  highlights: ["Cologne Cathedral", "Black Forest"],
  inclusionsHtml: "<p>All meals</p>",
  exclusionsHtml: "<p>Excursions extra</p>",
  regionIds: ["region:western-europe"],
  waterwayIds: ["river:Q584"],
  portIds: ["port:NLAMS", "port:CHBSL"],
  countryIso: ["NL", "CH"],
  regions: ["Western Europe"],
  waterways: ["Rhine"],
  ports: ["Amsterdam", "Basel"],
  countries: ["Netherlands", "Switzerland"],
  themes: ["culture", "history"],
  heroImageUrl: "https://example.com/hero.jpg",
  mapImageUrl: "https://example.com/map.jpg",
  status: "draft" as const,
  lowestPriceCached: "3499.00",
  lowestPriceCurrencyCached: "EUR",
  earliestDepartureCached: "2026-04-01",
  latestDepartureCached: "2026-10-31",
  externalRefs: { vikingId: "WAVE2026-RHN-15D" },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
  // biome-ignore lint/suspicious/noExplicitAny: test fixture -- owner: cruises; existing suppression is intentional pending typed cleanup.
} as any

describe("cruiseRowToProjection", () => {
  it("maps every column to its catalog-policy path", () => {
    const projection = cruiseRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("name")).toBe("15-Day Rhine Discovery")
    expect(projection.get("nights")).toBe(14)
    expect(projection.get("cruiseType")).toBe("river")
    expect(projection.get("lineSupplierId")).toBe("supp_viking")
    expect(projection.get("embarkPortCanonicalPlaceId")).toBe("NLAMS")
    expect(projection.get("disembarkPortCanonicalPlaceId")).toBe("CHBSL")
    expect(projection.get("region_ids[]")).toEqual(["region:western-europe"])
    expect(projection.get("waterway_ids[]")).toEqual(["river:Q584"])
    expect(projection.get("port_ids[]")).toEqual(["port:NLAMS", "port:CHBSL"])
    expect(projection.get("country_iso[]")).toEqual(["NL", "CH"])
    expect(projection.get("waterways[]")).toEqual(["Rhine"])
    expect(projection.get("ports[]")).toEqual(["Amsterdam", "Basel"])
    expect(projection.get("countries[]")).toEqual(["Netherlands", "Switzerland"])
    expect(projection.get("highlights")).toEqual(["Cologne Cathedral", "Black Forest"])
    expect(projection.get("thumbnailUrl")).toBe("https://example.com/hero.jpg")
    expect(projection.get("lowestPriceCached")).toBe(349900)
    expect(projection.get("lowestPriceUnit")).toBe("minor")
  })

  it("synthesizes owned provenance by default", () => {
    const projection = cruiseRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(projection.get("source.kind")).toBe("owned")
    expect(projection.get("seller.operator_id")).toBe("op_xyz")
  })

  it("accepts sourced provenance for Voyant Connect peers", () => {
    const projection = cruiseRowToProjection(sampleRow, {
      sellerOperatorId: "op_xyz",
      sourceKind: "voyant-connect",
      sourceRef: "viking_rhn_15d",
    })
    expect(projection.get("source.kind")).toBe("voyant-connect")
    expect(projection.get("source.ref")).toBe("viking_rhn_15d")
  })
})

describe("cruiseProvenance", () => {
  it("returns owned static-freshness for owned cruises", () => {
    const p = cruiseProvenance(sampleRow, { sellerOperatorId: "op_xyz" })
    expect(p.source_kind).toBe("owned")
    expect(p.source_freshness).toBe("static")
  })

  it("returns sync-freshness for sourced cruises", () => {
    const p = cruiseProvenance(sampleRow, {
      sellerOperatorId: "op_xyz",
      sourceKind: "voyant-connect",
      sourceRef: "x",
    })
    expect(p.source_kind).toBe("voyant-connect")
    expect(p.source_freshness).toBe("sync")
  })
})

describe("end-to-end: projection + resolver", () => {
  it("applies marketing overlay on cruise name for customer audience", () => {
    const projection = cruiseRowToProjection(sampleRow, { sellerOperatorId: "op_xyz" })
    const registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
    const view = resolveOverlay(
      registry,
      projection,
      [
        {
          field_path: "name",
          locale: "en-GB",
          audience: "customer",
          market: "default",
          value: "✨ Magical Rhine Voyage",
        },
      ],
      { locale: "en-GB", audience: "customer", market: "default", actor: "customer" },
    )
    expect(view.values.get("name")).toBe("✨ Magical Rhine Voyage")
  })
})

describe("createCruiseDocumentBuilder", () => {
  const customerSlice = {
    vertical: "cruises",
    locale: "en-GB",
    audience: "customer",
    market: "default",
  } as const
  const staffSlice = { ...customerSlice, audience: "staff" } as const

  it("keeps non-live cruises out of customer slices while preserving staff docs", async () => {
    const builder = createCruiseDocumentBuilder(fakeDb(new Map([[cruises, [sampleRow]]])), {
      sellerOperatorId: "op_xyz",
    })

    await expect(builder("crse_abc", customerSlice)).resolves.toBeNull()
    await expect(builder("crse_abc", staffSlice)).resolves.not.toBeNull()
  })

  it("requires an open future sailing with an available price for customer docs", async () => {
    const liveRow = { ...sampleRow, status: "live" }
    const builderWithoutPrice = createCruiseDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [cruises, [liveRow]],
          [
            cruiseSailings,
            [
              {
                id: "sail_1",
                cruiseId: liveRow.id,
                shipId: "ship_1",
                departureDate: "2099-01-15",
                returnDate: "2099-01-22",
                salesStatus: "open",
              },
            ],
          ],
          [cruisePrices, [{ id: "price_1", sailingId: "sail_1", availability: "sold_out" }]],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )
    await expect(builderWithoutPrice("crse_abc", customerSlice)).resolves.toBeNull()

    const laterSailings = Array.from({ length: 51 }, (_, index) => {
      const departureDate = new Date(Date.UTC(2099, 0, index + 1)).toISOString().slice(0, 10)
      const returnDate = new Date(Date.UTC(2099, 0, index + 8)).toISOString().slice(0, 10)
      return {
        id: `sail_${index + 1}`,
        cruiseId: liveRow.id,
        shipId: "ship_1",
        departureDate,
        returnDate,
        salesStatus: "open",
      }
    })
    const builderWithPriceAfterFiftySailings = createCruiseDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [cruises, [liveRow]],
          [cruiseSailings, laterSailings],
          [
            cruisePrices,
            [
              {
                id: "price_51",
                sailingId: "sail_51",
                availability: "available",
                availabilityCount: 2,
              },
            ],
          ],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )
    await expect(
      builderWithPriceAfterFiftySailings("crse_abc", customerSlice),
    ).resolves.not.toBeNull()

    const builderWithPrice = createCruiseDocumentBuilder(
      fakeDb(
        new Map<unknown, unknown[]>([
          [cruises, [liveRow]],
          [
            cruiseSailings,
            [
              {
                id: "sail_1",
                cruiseId: liveRow.id,
                shipId: "ship_1",
                departureDate: "2099-01-15",
                returnDate: "2099-01-22",
                salesStatus: "open",
              },
            ],
          ],
          [
            cruisePrices,
            [
              {
                id: "price_1",
                sailingId: "sail_1",
                availability: "available",
                availabilityCount: 2,
              },
            ],
          ],
        ]),
      ),
      { sellerOperatorId: "op_xyz" },
    )

    await expect(builderWithPrice("crse_abc", customerSlice)).resolves.not.toBeNull()
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
  }
  return chain
}

type QueryPromise = Promise<unknown[]> & {
  limit: (limit: number) => Promise<unknown[]>
}

function promiseChain(rows: unknown[]): QueryPromise {
  const promise = Promise.resolve(rows) as QueryPromise
  promise.limit = async (limit: number) => rows.slice(0, limit)
  return promise
}
