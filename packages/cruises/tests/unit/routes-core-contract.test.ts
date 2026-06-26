import { listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"

import {
  cruiseCabinCategoryRowSchema,
  cruiseCabinRowSchema,
  cruiseDayRowSchema,
  cruiseDeckRowSchema,
  cruiseRowSchema,
  cruiseShipRowSchema,
  dataEnvelope,
  enrichmentProgramRowSchema,
} from "../../src/routes-openapi-schemas.js"
import type {
  CruiseCabin,
  CruiseCabinCategory,
  CruiseDeck,
  CruiseShip,
} from "../../src/schema-cabins.js"
import type { CruiseEnrichmentProgram } from "../../src/schema-content.js"
import type { Cruise } from "../../src/schema-core.js"
import type { CruiseDay } from "../../src/schema-itinerary.js"

/**
 * Contract tests for the cruise admin core/detail/ships wire shapes
 * (voyant#2114, cruises sub-batch 1). The handlers `c.json(...)` raw Drizzle
 * rows, so `timestamp` columns reach the wire as ISO strings (§17 Date→string)
 * while `date`/`time`/`numeric` columns are already strings. Fixtures are typed
 * to each table's `$inferSelect` so a schema drift surfaces as a type error,
 * and the assertions parse the JSON round-trip of the raw row.
 */

const TS = new Date("2026-06-26T00:00:00.000Z")

/** Reproduce the wire form: JSON serialize then re-parse (Date → ISO string). */
function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

const cruise: Cruise = {
  id: "cru_01",
  slug: "fjords-7",
  name: "Fjords 7",
  cruiseType: "ocean",
  lineSupplierId: null,
  defaultShipId: null,
  nights: 7,
  embarkPortFacilityId: null,
  embarkPortCanonicalPlaceId: null,
  disembarkPortFacilityId: null,
  disembarkPortCanonicalPlaceId: null,
  description: null,
  shortDescription: null,
  highlights: [],
  inclusionsHtml: null,
  exclusionsHtml: null,
  regionIds: [],
  waterwayIds: [],
  portIds: [],
  countryIso: ["NO"],
  regions: ["Norway"],
  waterways: [],
  ports: ["Bergen"],
  countries: ["Norway"],
  themes: ["scenic"],
  heroImageUrl: null,
  mapImageUrl: null,
  status: "draft",
  lowestPriceCached: "1999.00",
  lowestPriceCurrencyCached: "USD",
  earliestDepartureCached: "2027-06-01",
  latestDepartureCached: "2027-08-01",
  externalRefs: {},
  customerPaymentPolicy: null,
  createdAt: TS,
  updatedAt: TS,
}

const ship: CruiseShip = {
  id: "crsh_01",
  lineSupplierId: null,
  name: "MV Test",
  slug: "mv-test",
  shipType: "ocean",
  capacityGuests: 1200,
  capacityCrew: 600,
  cabinCount: 600,
  deckCount: 12,
  lengthMeters: "250.00",
  cruisingSpeedKnots: "21.50",
  yearBuilt: 2020,
  yearRefurbished: null,
  imo: "1234567",
  description: null,
  deckPlanUrl: null,
  gallery: [],
  amenities: {},
  externalRefs: {},
  isActive: true,
  createdAt: TS,
  updatedAt: TS,
}

const deck: CruiseDeck = {
  id: "crdk_01",
  shipId: "crsh_01",
  name: "Deck 5",
  level: 5,
  planImageUrl: null,
  createdAt: TS,
  updatedAt: TS,
}

const category: CruiseCabinCategory = {
  id: "crcc_01",
  shipId: "crsh_01",
  code: "BAL",
  name: "Balcony",
  roomType: "balcony",
  description: null,
  minOccupancy: 1,
  maxOccupancy: 2,
  squareFeet: "180.00",
  wheelchairAccessible: false,
  amenities: ["tv"],
  featureCodes: [],
  bedConfigurations: ["queen"],
  accessibilityFeatures: [],
  viewType: "ocean",
  images: [],
  floorplanImages: [],
  gradeCodes: [],
  externalRefs: {},
  customerPaymentPolicy: null,
  createdAt: TS,
  updatedAt: TS,
}

const cabin: CruiseCabin = {
  id: "crcb_01",
  categoryId: "crcc_01",
  cabinNumber: "5012",
  deckId: "crdk_01",
  position: "port",
  connectsTo: null,
  notes: null,
  isActive: true,
  createdAt: TS,
  updatedAt: TS,
}

const day: CruiseDay = {
  id: "crd_01",
  cruiseId: "cru_01",
  dayNumber: 1,
  title: "Embark Bergen",
  description: null,
  portFacilityId: null,
  portCanonicalPlaceId: null,
  arrivalTime: null,
  departureTime: "18:00:00",
  isOvernight: false,
  isSeaDay: false,
  isExpeditionLanding: false,
  meals: { dinner: true },
  createdAt: TS,
  updatedAt: TS,
}

const enrichment: CruiseEnrichmentProgram = {
  id: "crep_01",
  cruiseId: "cru_01",
  kind: "naturalist",
  name: "Dr. Naturalist",
  title: "Lead Naturalist",
  description: null,
  bioImageUrl: null,
  sortOrder: 0,
  createdAt: TS,
  updatedAt: TS,
}

describe("cruise admin row contracts", () => {
  it("cruiseRowSchema accepts a serialized cruise row (timestamps → strings)", () => {
    const parsed = cruiseRowSchema.parse(toWire(cruise))
    expect(parsed.slug).toBe("fjords-7")
    expect(typeof parsed.createdAt).toBe("string")
    expect(parsed.lowestPriceCached).toBe("1999.00")
    expect(parsed.earliestDepartureCached).toBe("2027-06-01")
  })

  it("cruiseShipRowSchema accepts a serialized ship row (numeric → strings)", () => {
    const parsed = cruiseShipRowSchema.parse(toWire(ship))
    expect(parsed.shipType).toBe("ocean")
    expect(parsed.lengthMeters).toBe("250.00")
    expect(parsed.isActive).toBe(true)
  })

  it("cruiseDeckRowSchema accepts a serialized deck row", () => {
    expect(cruiseDeckRowSchema.parse(toWire(deck)).level).toBe(5)
  })

  it("cruiseCabinCategoryRowSchema accepts a serialized category row", () => {
    const parsed = cruiseCabinCategoryRowSchema.parse(toWire(category))
    expect(parsed.roomType).toBe("balcony")
    expect(parsed.bedConfigurations).toEqual(["queen"])
  })

  it("cruiseCabinRowSchema accepts a serialized cabin row", () => {
    expect(cruiseCabinRowSchema.parse(toWire(cabin)).cabinNumber).toBe("5012")
  })

  it("cruiseDayRowSchema accepts a serialized itinerary day", () => {
    const parsed = cruiseDayRowSchema.parse(toWire(day))
    expect(parsed.dayNumber).toBe(1)
    expect(parsed.meals).toEqual({ dinner: true })
  })

  it("enrichmentProgramRowSchema accepts a serialized program", () => {
    expect(enrichmentProgramRowSchema.parse(toWire(enrichment)).kind).toBe("naturalist")
  })
})

describe("cruise admin envelope contracts", () => {
  it("ships list uses the canonical listResponse envelope", () => {
    const wire = toWire({ data: [ship], total: 1, limit: 50, offset: 0 })
    const parsed = listResponseSchema(cruiseShipRowSchema).parse(wire)
    expect(parsed.total).toBe(1)
    expect(parsed.data[0]?.slug).toBe("mv-test")
  })

  it("single-entity reads use a { data } envelope", () => {
    const parsed = dataEnvelope(cruiseRowSchema).parse(toWire({ data: cruise }))
    expect(parsed.data.id).toBe("cru_01")
  })

  it("bulk cabin replace uses a { data: [] } envelope", () => {
    const parsed = dataEnvelope(cruiseCabinRowSchema.array()).parse(toWire({ data: [cabin] }))
    expect(parsed.data).toHaveLength(1)
  })
})
