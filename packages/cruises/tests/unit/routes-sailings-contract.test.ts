import { listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"

import {
  cruisePriceRowSchema,
  cruiseSailingDayRowSchema,
  cruiseSailingRowSchema,
  cruiseSearchIndexRowSchema,
  cruiseVoyageGroupRowSchema,
  cruiseVoyageGroupSegmentRowSchema,
  dataEnvelope,
} from "../../src/routes-openapi-schemas.js"
import type {
  CruiseSailing,
  CruiseVoyageGroup,
  CruiseVoyageGroupSegment,
} from "../../src/schema-core.js"
import type { CruiseSailingDay } from "../../src/schema-itinerary.js"
import type { CruisePrice } from "../../src/schema-pricing.js"
import type { CruiseSearchIndexRow } from "../../src/schema-search.js"

/**
 * Contract tests for the cruise admin sailings/prices, voyage-groups and
 * search-index wire shapes (voyant#2114, cruises sub-batch 2). Handlers
 * `c.json(...)` raw Drizzle rows, so `timestamp` columns reach the wire as ISO
 * strings (§17 Date→string) while `date`/`time`/`numeric` columns are already
 * strings. Fixtures are typed to each table's `$inferSelect` so a schema drift
 * surfaces as a type error; assertions parse the JSON round-trip of the row.
 *
 * Note `cruisePrices.pricePerPerson` (and the search index `lowestPriceCents`,
 * which is MINOR units, integer) reflect the existing column types faithfully.
 */

const TS = new Date("2026-06-26T00:00:00.000Z")

/** Reproduce the wire form: JSON serialize then re-parse (Date → ISO string). */
function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

const sailing: CruiseSailing = {
  id: "crsl_01",
  cruiseId: "cru_01",
  shipId: "crsh_01",
  departureDate: "2027-06-01",
  returnDate: "2027-06-08",
  embarkPortFacilityId: null,
  embarkPortCanonicalPlaceId: null,
  disembarkPortFacilityId: null,
  disembarkPortCanonicalPlaceId: null,
  direction: "round_trip",
  availabilityNote: null,
  isCharter: false,
  salesStatus: "open",
  externalRefs: {},
  customerPaymentPolicy: null,
  lastSyncedAt: TS,
  createdAt: TS,
  updatedAt: TS,
}

const price: CruisePrice = {
  id: "crpr_01",
  sailingId: "crsl_01",
  cabinCategoryId: "crcc_01",
  occupancy: 2,
  fareCode: "BESTFARE",
  fareCodeName: "Best Fare",
  fareVariant: "cruise_only",
  currency: "USD",
  pricePerPerson: "1999.00",
  originalPricePerPerson: "2499.00",
  secondGuestPricePerPerson: null,
  singlePricePerPerson: null,
  singleSupplementPercent: "50.00",
  availability: "available",
  availabilityCount: 8,
  priceCatalogId: null,
  priceScheduleId: null,
  bookingDeadline: null,
  earlyBookingDeadline: "2027-01-01",
  earlyBookingBonusDescription: null,
  requiresRequest: false,
  notes: null,
  externalRefs: {},
  lastSyncedAt: TS,
  createdAt: TS,
  updatedAt: TS,
}

const sailingDay: CruiseSailingDay = {
  id: "crsd_01",
  sailingId: "crsl_01",
  dayNumber: 1,
  title: "Embark Bergen",
  description: null,
  portFacilityId: null,
  portCanonicalPlaceId: null,
  arrivalTime: null,
  departureTime: "18:00:00",
  isOvernight: false,
  isSeaDay: null,
  isExpeditionLanding: null,
  isSkipped: false,
  meals: { dinner: true },
  createdAt: TS,
  updatedAt: TS,
}

const voyageGroup: CruiseVoyageGroup = {
  id: "crvg_01",
  slug: "grand-voyage-2027",
  name: "Grand Voyage 2027",
  groupKind: "grand_voyage",
  lineSupplierId: null,
  nights: 30,
  embarkPortFacilityId: null,
  embarkPortCanonicalPlaceId: null,
  disembarkPortFacilityId: null,
  disembarkPortCanonicalPlaceId: null,
  description: null,
  shortDescription: null,
  highlights: ["world cruise"],
  regions: ["Pacific"],
  themes: [],
  heroImageUrl: null,
  mapImageUrl: null,
  status: "draft",
  lowestPriceCached: "9999.00",
  lowestPriceCurrencyCached: "USD",
  earliestDepartureCached: "2027-01-05",
  latestDepartureCached: "2027-02-05",
  externalRefs: {},
  createdAt: TS,
  updatedAt: TS,
}

const voyageSegment: CruiseVoyageGroupSegment = {
  id: "crvs_01",
  voyageGroupId: "crvg_01",
  sortOrder: 0,
  segmentKind: "cruise",
  segmentRole: "core",
  title: "Leg 1",
  description: null,
  cruiseId: "cru_01",
  sailingId: "crsl_01",
  startDay: 1,
  endDay: 8,
  startDate: "2027-01-05",
  endDate: "2027-01-12",
  embarkPortFacilityId: null,
  embarkPortCanonicalPlaceId: null,
  disembarkPortFacilityId: null,
  disembarkPortCanonicalPlaceId: null,
  nights: 7,
  externalRefs: {},
  metadata: {},
  createdAt: TS,
  updatedAt: TS,
}

const searchEntry: CruiseSearchIndexRow = {
  id: "crsi_01",
  source: "local",
  sourceProvider: null,
  sourceRef: null,
  localCruiseId: "cru_01",
  slug: "fjords-7",
  name: "Fjords 7",
  cruiseType: "ocean",
  lineName: "Test Line",
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
  departureCount: 5,
  lowestPriceCents: 199900,
  lowestPriceCurrency: "USD",
  salesStatus: "open",
  heroImageUrl: null,
  refreshedAt: TS,
  createdAt: TS,
  updatedAt: TS,
}

describe("cruise admin sailings/prices row contracts", () => {
  it("cruiseSailingRowSchema accepts a serialized sailing row", () => {
    const parsed = cruiseSailingRowSchema.parse(toWire(sailing))
    expect(parsed.salesStatus).toBe("open")
    expect(parsed.departureDate).toBe("2027-06-01")
    expect(typeof parsed.lastSyncedAt).toBe("string")
  })

  it("cruisePriceRowSchema accepts a serialized price row (numeric → strings)", () => {
    const parsed = cruisePriceRowSchema.parse(toWire(price))
    expect(parsed.pricePerPerson).toBe("1999.00")
    expect(parsed.fareVariant).toBe("cruise_only")
    expect(parsed.availability).toBe("available")
  })

  it("cruiseSailingDayRowSchema accepts a serialized day override (nullable booleans)", () => {
    const parsed = cruiseSailingDayRowSchema.parse(toWire(sailingDay))
    expect(parsed.dayNumber).toBe(1)
    expect(parsed.isSeaDay).toBeNull()
    expect(parsed.isSkipped).toBe(false)
    expect(parsed.meals).toEqual({ dinner: true })
  })
})

describe("cruise admin voyage-group row contracts", () => {
  it("cruiseVoyageGroupRowSchema accepts a serialized voyage group", () => {
    const parsed = cruiseVoyageGroupRowSchema.parse(toWire(voyageGroup))
    expect(parsed.groupKind).toBe("grand_voyage")
    expect(parsed.lowestPriceCached).toBe("9999.00")
  })

  it("cruiseVoyageGroupSegmentRowSchema accepts a serialized segment", () => {
    const parsed = cruiseVoyageGroupSegmentRowSchema.parse(toWire(voyageSegment))
    expect(parsed.segmentKind).toBe("cruise")
    expect(parsed.segmentRole).toBe("core")
    expect(parsed.nights).toBe(7)
  })
})

describe("cruise admin search-index row contracts", () => {
  it("cruiseSearchIndexRowSchema accepts a serialized entry (lowestPriceCents is MINOR units)", () => {
    const parsed = cruiseSearchIndexRowSchema.parse(toWire(searchEntry))
    expect(parsed.source).toBe("local")
    expect(parsed.lowestPriceCents).toBe(199900)
    expect(parsed.cruiseType).toBe("ocean")
  })
})

describe("cruise admin sailings/prices envelope contracts", () => {
  it("sailings list uses the canonical listResponse envelope", () => {
    const wire = toWire({ data: [sailing], total: 1, limit: 50, offset: 0 })
    const parsed = listResponseSchema(cruiseSailingRowSchema).parse(wire)
    expect(parsed.total).toBe(1)
    expect(parsed.data[0]?.id).toBe("crsl_01")
  })

  it("prices list uses the canonical listResponse envelope", () => {
    const wire = toWire({ data: [price], total: 1, limit: 50, offset: 0 })
    const parsed = listResponseSchema(cruisePriceRowSchema).parse(wire)
    expect(parsed.data[0]?.pricePerPerson).toBe("1999.00")
  })

  it("voyage-groups list uses the canonical listResponse envelope", () => {
    const wire = toWire({ data: [voyageGroup], total: 1, limit: 50, offset: 0 })
    const parsed = listResponseSchema(cruiseVoyageGroupRowSchema).parse(wire)
    expect(parsed.data[0]?.slug).toBe("grand-voyage-2027")
  })

  it("single-entity reads use a { data } envelope", () => {
    const parsed = dataEnvelope(cruiseVoyageGroupSegmentRowSchema).parse(
      toWire({ data: voyageSegment }),
    )
    expect(parsed.data.id).toBe("crvs_01")
  })

  it("bulk replace uses a { data: [] } envelope", () => {
    const parsed = dataEnvelope(cruisePriceRowSchema.array()).parse(toWire({ data: [price] }))
    expect(parsed.data).toHaveLength(1)
  })
})
