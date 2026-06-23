import { listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"
import { cruiseSearchIndexRowSchema } from "../../src/routes-public.js"
import type { CruiseSearchIndexRow } from "../../src/schema-search.js"

/**
 * Contract tests for the public cruise search-index wire shape (voyant#2114).
 *
 * The `GET /v1/public/cruises` list endpoint serializes raw `cruise_search_index`
 * rows. Drizzle returns `date` columns (`earliestDeparture`/`latestDeparture`)
 * as strings and `timestamp` columns (`refreshedAt`/`createdAt`/`updatedAt`) as
 * `Date`s. The handler `c.json(...)`s the row, so the timestamps reach the wire
 * as ISO strings — these tests assert the documented schema matches that wire
 * form (§17 Date→string), via a JSON round-trip of the raw row.
 */

const rawRow: CruiseSearchIndexRow = {
  id: "cruise_search_index_01",
  source: "local",
  sourceProvider: null,
  sourceRef: null,
  localCruiseId: "cruise_01",
  slug: "fjords-7",
  name: "Fjords 7",
  cruiseType: "ocean",
  lineName: "Acme Cruises",
  shipName: "MV Test",
  nights: 7,
  embarkPortName: "Bergen",
  embarkPortCanonicalPlaceId: null,
  disembarkPortName: "Bergen",
  disembarkPortCanonicalPlaceId: null,
  regionIds: [],
  waterwayIds: [],
  portIds: [],
  countryIso: ["NO"],
  regions: ["Norway"],
  waterways: [],
  ports: ["Bergen"],
  countries: ["Norway"],
  themes: ["scenic"],
  earliestDeparture: "2027-06-01",
  latestDeparture: "2027-08-01",
  departureCount: 3,
  lowestPriceCents: 199900,
  lowestPriceCurrency: "USD",
  salesStatus: "open",
  heroImageUrl: "https://cdn.example.com/hero.jpg",
  refreshedAt: new Date("2026-06-24T00:00:00.000Z"),
  createdAt: new Date("2026-06-24T00:00:00.000Z"),
  updatedAt: new Date("2026-06-24T00:00:00.000Z"),
}

/** Reproduce the wire form: JSON serialize then re-parse (Date → ISO string). */
function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe("cruiseSearchIndexRowSchema contract", () => {
  it("accepts a serialized search-index row", () => {
    const parsed = cruiseSearchIndexRowSchema.parse(toWire(rawRow))
    expect(parsed.slug).toBe("fjords-7")
    expect(typeof parsed.refreshedAt).toBe("string")
    expect(parsed.refreshedAt).toBe("2026-06-24T00:00:00.000Z")
    expect(parsed.earliestDeparture).toBe("2027-06-01")
  })

  it("accepts an external row with an opaque sourceRef and null dates", () => {
    const externalRow: CruiseSearchIndexRow = {
      ...rawRow,
      id: "cruise_search_index_02",
      source: "external",
      sourceProvider: "voyant-connect",
      sourceRef: { externalId: "ext-1", connectionId: "conn-1" },
      localCruiseId: null,
      earliestDeparture: null,
      latestDeparture: null,
      departureCount: null,
      lowestPriceCents: null,
      lowestPriceCurrency: null,
      salesStatus: null,
      heroImageUrl: null,
    }
    const parsed = cruiseSearchIndexRowSchema.parse(toWire(externalRow))
    expect(parsed.source).toBe("external")
    expect(parsed.earliestDeparture).toBeNull()
    expect(parsed.sourceRef).toEqual({ externalId: "ext-1", connectionId: "conn-1" })
  })

  it("round-trips the list envelope", () => {
    const envelopeSchema = listResponseSchema(cruiseSearchIndexRowSchema)
    const wire = toWire({ data: [rawRow], total: 1, limit: 20, offset: 0 })
    const parsed = envelopeSchema.parse(wire)
    expect(parsed.total).toBe(1)
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0]?.cruiseType).toBe("ocean")
  })
})
