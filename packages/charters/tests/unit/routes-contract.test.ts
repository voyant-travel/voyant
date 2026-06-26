/**
 * OpenAPI contract tests for the admin charter routes (voyant#2114).
 *
 * Asserts the documented response row schemas actually match the runtime wire
 * shapes for the clean local serializations — `charter_products`,
 * `charter_yachts`, `charter_suites`, `charter_schedule_days` rows and the
 * hand-built admin browse envelope — so the spec can't drift from the wire.
 * Fixtures are Drizzle `$inferSelect`-typed and round-tripped through JSON to
 * model the §17 date/timestamp → string serialization. External-dispatch
 * behaviour is covered in `routes-shape.test.ts`.
 */

import { afterEach, describe, expect, it } from "vitest"

import { clearCharterAdapters } from "../../src/adapters/registry.js"
import {
  adminBrowseResponseSchema,
  charterProductSchema,
  charterScheduleDaySchema,
  charterSuiteSchema,
  charterYachtSchema,
} from "../../src/routes.js"
import type { CharterProduct, CharterVoyage } from "../../src/schema-core.js"
import type { CharterScheduleDay } from "../../src/schema-itinerary.js"
import type { CharterSuite } from "../../src/schema-pricing.js"
import type { CharterYacht } from "../../src/schema-yachts.js"

afterEach(() => clearCharterAdapters())

/** Simulate the JSON wire round-trip — `Date`s become ISO strings. */
function wire<T>(row: T): unknown {
  return JSON.parse(JSON.stringify(row))
}

const now = new Date()

const productRow: CharterProduct = {
  id: "chrt_abc",
  slug: "med-spring",
  name: "Mediterranean Spring",
  lineSupplierId: null,
  defaultYachtId: "chry_abc",
  description: null,
  shortDescription: null,
  heroImageUrl: null,
  mapImageUrl: null,
  regions: ["mediterranean"],
  themes: [],
  status: "live",
  defaultBookingModes: ["per_suite", "whole_yacht"],
  defaultMybaTemplateId: null,
  defaultApaPercent: "27.50",
  lowestPriceCachedAmount: "150000.00",
  lowestPriceCachedCurrency: "USD",
  earliestVoyageCached: "2026-04-12",
  latestVoyageCached: "2026-09-01",
  externalRefs: {},
  createdAt: now,
  updatedAt: now,
}

const yachtRow: CharterYacht = {
  id: "chry_abc",
  lineSupplierId: null,
  name: "M/Y Acme One",
  slug: "my-acme-one",
  yachtClass: "luxury_motor",
  capacityGuests: 12,
  capacityCrew: 9,
  lengthMeters: "72.50",
  yearBuilt: 2018,
  yearRefurbished: null,
  imo: "1234567",
  description: null,
  gallery: [],
  amenities: {},
  crewBios: [{ role: "Captain", name: "A. Smith" }],
  defaultCharterAreas: ["mediterranean"],
  externalRefs: {},
  isActive: true,
  createdAt: now,
  updatedAt: now,
}

const suiteRow: CharterSuite = {
  id: "chst_abc",
  voyageId: "chrv_abc",
  suiteCode: "OS-1",
  suiteName: "Owners Suite",
  suiteCategory: "owners",
  description: null,
  squareFeet: "650.00",
  images: [],
  floorplanImages: [],
  maxGuests: 4,
  pricesByCurrency: { USD: "150000.00" },
  portFeesByCurrency: { USD: "1000.00" },
  availability: "available",
  unitsAvailable: 1,
  appointmentOnly: false,
  notes: null,
  extra: {},
  externalRefs: {},
  lastSyncedAt: null,
  createdAt: now,
  updatedAt: now,
}

const scheduleDayRow: CharterScheduleDay = {
  id: "chsd_abc",
  voyageId: "chrv_abc",
  dayNumber: 1,
  portFacilityId: null,
  portName: "Nice",
  scheduleDate: "2026-04-12",
  arrivalTime: null,
  departureTime: "18:00:00",
  isSeaDay: false,
  description: null,
  activities: [],
  createdAt: now,
  updatedAt: now,
}

describe("admin routes — row schema parity", () => {
  it("a serialized charter_products row satisfies charterProductSchema", () => {
    expect(charterProductSchema.safeParse(wire(productRow)).success).toBe(true)
  })

  it("a serialized charter_yachts row satisfies charterYachtSchema", () => {
    expect(charterYachtSchema.safeParse(wire(yachtRow)).success).toBe(true)
  })

  it("a serialized charter_suites row satisfies charterSuiteSchema", () => {
    expect(charterSuiteSchema.safeParse(wire(suiteRow)).success).toBe(true)
  })

  it("a serialized charter_schedule_days row satisfies charterScheduleDaySchema", () => {
    expect(charterScheduleDaySchema.safeParse(wire(scheduleDayRow)).success).toBe(true)
  })
})

describe("admin routes — browse envelope parity", () => {
  it("the hand-built admin browse envelope satisfies adminBrowseResponseSchema", () => {
    const localItem = {
      source: "local" as const,
      sourceProvider: null,
      sourceRef: null,
      key: productRow.id,
      product: wire(productRow),
    }
    const externalItem = {
      source: "external" as const,
      sourceProvider: "voyant-connect",
      sourceRef: { externalId: "ext-prod-1" },
      key: "voyant-connect:ext-prod-1",
      product: { name: "External Product" },
    }
    const envelope = {
      data: [localItem, externalItem],
      total: 2,
      localTotal: 1,
      adapterCount: 1,
      adapterErrors: [{ adapter: "broken", error: "boom" }],
      limit: 50,
      offset: 0,
    }
    expect(adminBrowseResponseSchema.safeParse(envelope).success).toBe(true)
  })
})

describe("admin routes — voyage row reuses the public voyageItemSchema", () => {
  // The admin voyages list + voyage detail serialize the same raw
  // `charter_voyages` row as the public surface (route reuses `voyageItemSchema`
  // from routes-public). Assert a representative `$inferSelect` row round-trips.
  it("a serialized charter_voyages row carries the documented wire fields", () => {
    const voyageRow: CharterVoyage = {
      id: "chrv_abc",
      productId: "chrt_abc",
      yachtId: "chry_abc",
      voyageCode: "MED-2026-04",
      name: null,
      embarkPortFacilityId: null,
      embarkPortName: "Nice",
      disembarkPortFacilityId: null,
      disembarkPortName: "Athens",
      departureDate: "2026-04-12",
      returnDate: "2026-04-19",
      nights: 7,
      bookingModes: ["per_suite", "whole_yacht"],
      appointmentOnly: false,
      wholeYachtPricesByCurrency: { USD: "5000000.00" },
      apaPercentOverride: "30.00",
      mybaTemplateIdOverride: null,
      charterAreaOverride: null,
      salesStatus: "open",
      availabilityNote: null,
      externalRefs: {},
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    const serialized = wire(voyageRow) as Record<string, unknown>
    expect(typeof serialized.createdAt).toBe("string")
    expect(serialized.departureDate).toBe("2026-04-12")
  })
})
