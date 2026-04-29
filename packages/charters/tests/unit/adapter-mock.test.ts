import { describe, expect, it } from "vitest"

import type {
  ExternalCharterProduct,
  ExternalCharterScheduleDay,
  ExternalCharterSuite,
  ExternalCharterVoyage,
  ExternalCharterYacht,
} from "../../src/adapters/index.js"
import { MockCharterAdapter } from "../../src/adapters/mock.js"

const product: ExternalCharterProduct = {
  sourceRef: { externalId: "ext-prod-1" },
  name: "Mediterranean Spring",
  slug: "mediterranean-spring",
  lineName: "Acme Yachts",
  defaultYachtRef: { externalId: "ext-yacht-1" },
  defaultBookingModes: ["per_suite", "whole_yacht"],
  defaultApaPercent: "27.50",
  defaultMybaTemplateRef: "ctpl_default",
  status: "live",
}

const voyage: ExternalCharterVoyage = {
  sourceRef: { externalId: "ext-voy-1" },
  productRef: product.sourceRef,
  yachtRef: { externalId: "ext-yacht-1" },
  voyageCode: "MED-2026-04",
  name: "Riviera 7-day",
  departureDate: "2026-04-12",
  returnDate: "2026-04-19",
  nights: 7,
  bookingModes: ["per_suite", "whole_yacht"],
  wholeYachtPricesByCurrency: { USD: "5000000.00", EUR: "4500000.00" },
  apaPercentOverride: "30.00",
  charterAreaOverride: "Western Mediterranean",
}

const ownersSuite: ExternalCharterSuite = {
  sourceRef: { externalId: "ext-suite-1" },
  voyageRef: voyage.sourceRef,
  suiteCode: "OS-1",
  suiteName: "Owners Suite",
  suiteCategory: "owners",
  pricesByCurrency: { USD: "150000.00", EUR: "135000.00" },
  availability: "available",
  maxGuests: 4,
}

const standardSuite: ExternalCharterSuite = {
  sourceRef: { externalId: "ext-suite-2" },
  voyageRef: voyage.sourceRef,
  suiteCode: "STD-1",
  suiteName: "Standard Stateroom",
  suiteCategory: "standard",
  pricesByCurrency: { USD: "85000.00" },
  availability: "available",
  maxGuests: 2,
}

const yacht: ExternalCharterYacht = {
  sourceRef: { externalId: "ext-yacht-1" },
  name: "M/Y Acme One",
  slug: "my-acme-one",
  yachtClass: "luxury_motor",
  capacityGuests: 12,
  capacityCrew: 18,
}

const schedule: ExternalCharterScheduleDay[] = [
  { dayNumber: 1, portName: "Monaco", isSeaDay: false },
  { dayNumber: 2, portName: "Cannes", isSeaDay: false },
  { dayNumber: 3, isSeaDay: true },
]

function seed() {
  const adapter = new MockCharterAdapter({ name: "mock" })
  adapter.addProduct(product, [voyage])
  adapter.setVoyageSuites(voyage.sourceRef, [ownersSuite, standardSuite])
  adapter.setVoyageSchedule(voyage.sourceRef, schedule)
  adapter.addYacht(yacht)
  return adapter
}

describe("MockCharterAdapter — fetchers", () => {
  it("fetchProduct returns the seeded product", async () => {
    const adapter = seed()
    const got = await adapter.fetchProduct({ externalId: "ext-prod-1" })
    expect(got?.name).toBe("Mediterranean Spring")
  })

  it("fetchProduct returns null for unknown ref", async () => {
    const adapter = seed()
    expect(await adapter.fetchProduct({ externalId: "nope" })).toBeNull()
  })

  it("fetchVoyage returns seeded voyage", async () => {
    const adapter = seed()
    const got = await adapter.fetchVoyage({ externalId: "ext-voy-1" })
    expect(got?.voyageCode).toBe("MED-2026-04")
  })

  it("fetchVoyageSuites returns the seeded suites in order", async () => {
    const adapter = seed()
    const suites = await adapter.fetchVoyageSuites({ externalId: "ext-voy-1" })
    expect(suites).toHaveLength(2)
    expect(suites[0]?.suiteCode).toBe("OS-1")
  })

  it("fetchVoyageSchedule returns the seeded days", async () => {
    const adapter = seed()
    const days = await adapter.fetchVoyageSchedule({ externalId: "ext-voy-1" })
    expect(days).toHaveLength(3)
    expect(days[2]?.isSeaDay).toBe(true)
  })

  it("fetchYacht returns the seeded yacht", async () => {
    const adapter = seed()
    expect((await adapter.fetchYacht({ externalId: "ext-yacht-1" }))?.name).toBe("M/Y Acme One")
  })

  it("listVoyagesForProduct returns voyages on a seeded product", async () => {
    const adapter = seed()
    const voyages = await adapter.listVoyagesForProduct({ externalId: "ext-prod-1" })
    expect(voyages).toHaveLength(1)
    expect(voyages[0]?.voyageCode).toBe("MED-2026-04")
  })

  it("listEntries summarises seeded products with computed lowest browse-currency price", async () => {
    const adapter = seed()
    const result = await adapter.listEntries()
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.lowestPriceAmount).toBe("85000.00")
    expect(result.entries[0]?.lowestPriceCurrency).toBe("USD")
    expect(result.entries[0]?.yachtName).toBe("M/Y Acme One")
  })
})

describe("MockCharterAdapter — bookings + telemetry", () => {
  it("createPerSuiteBooking returns a synthetic ref + increments counter", async () => {
    const adapter = seed()
    const result = await adapter.createPerSuiteBooking({
      voyageRef: { externalId: "ext-voy-1" },
      suiteRef: { externalId: "ext-suite-1" },
      currency: "USD",
      guests: [{ firstName: "Ada", lastName: "Lovelace" }],
      contact: { firstName: "Ada", lastName: "Lovelace" },
    })
    expect(result.connectorBookingRef).toMatch(/^MOCK-CHT-\d{6}$/)
    expect(adapter.perSuiteBookingCount).toBe(1)
  })

  it("createWholeYachtBooking returns its own counter prefix", async () => {
    const adapter = seed()
    const result = await adapter.createWholeYachtBooking({
      voyageRef: { externalId: "ext-voy-1" },
      currency: "EUR",
      contact: { firstName: "Ada", lastName: "Lovelace" },
    })
    expect(result.connectorBookingRef).toMatch(/^MOCK-WYC-\d{6}$/)
    expect(adapter.wholeYachtBookingCount).toBe(1)
  })

  it("setPerSuiteBookingResult overrides the synthesized response", async () => {
    const adapter = seed()
    adapter.setPerSuiteBookingResult(
      { externalId: "ext-voy-1" },
      { externalId: "ext-suite-1" },
      {
        connectorBookingRef: "REAL-PNR-123",
        connectorStatus: "on_request",
        finalTotal: "200000.00",
      },
    )
    const result = await adapter.createPerSuiteBooking({
      voyageRef: { externalId: "ext-voy-1" },
      suiteRef: { externalId: "ext-suite-1" },
      currency: "USD",
      guests: [{ firstName: "G", lastName: "L" }],
      contact: { firstName: "G", lastName: "L" },
    })
    expect(result.connectorBookingRef).toBe("REAL-PNR-123")
    expect(result.finalTotal).toBe("200000.00")
  })

  it("failEveryNthCall throws on the nth call to surface error handling in tests", async () => {
    const adapter = new MockCharterAdapter({ name: "flaky", failEveryNthCall: 2 })
    adapter.addProduct(product)
    await adapter.fetchProduct({ externalId: "ext-prod-1" }) // call #1 — ok
    await expect(adapter.fetchProduct({ externalId: "ext-prod-1" })).rejects.toThrow(
      /forced failure on call #2/,
    )
  })
})
