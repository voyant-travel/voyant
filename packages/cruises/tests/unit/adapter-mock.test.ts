import { describe, expect, it } from "vitest"

import type { ExternalCruise, ExternalSailing, ExternalShip } from "../../src/adapters/index.js"
import { MockCruiseAdapter } from "../../src/adapters/mock.js"

const seedCruise: ExternalCruise = {
  sourceRef: { externalId: "ext-cru-1", connectionId: "conn-1" },
  name: "Norwegian Fjords",
  slug: "norwegian-fjords",
  cruiseType: "ocean",
  lineName: "Acme Cruises",
  defaultShipRef: { externalId: "ext-ship-1" },
  nights: 7,
}

const seedShip: ExternalShip = {
  sourceRef: { externalId: "ext-ship-1" },
  name: "MV Acme",
  slug: "mv-acme",
  shipType: "ocean",
  capacityGuests: 500,
}

const seedSailing: ExternalSailing = {
  sourceRef: { externalId: "ext-sl-1" },
  cruiseRef: { externalId: "ext-cru-1" },
  shipRef: { externalId: "ext-ship-1" },
  departureDate: "2026-06-15",
  returnDate: "2026-06-22",
  salesStatus: "open",
}

describe("MockCruiseAdapter — fetch round-trips", () => {
  it("returns seeded cruise via fetchCruise", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    expect(await adapter.fetchCruise(seedCruise.sourceRef)).toEqual(seedCruise)
  })

  it("returns null for unknown cruise refs", async () => {
    const adapter = new MockCruiseAdapter()
    expect(await adapter.fetchCruise({ externalId: "missing" })).toBeNull()
  })

  it("keeps adapter-specific SourceRef fields distinct", async () => {
    const adapter = new MockCruiseAdapter()
    const first = {
      ...seedCruise,
      sourceRef: { externalId: "same-id", connectionId: "conn-1", provider: "line-a" },
      slug: "same-a",
    }
    const second = {
      ...seedCruise,
      sourceRef: { externalId: "same-id", connectionId: "conn-2", provider: "line-b" },
      slug: "same-b",
    }
    adapter.addCruise(first)
    adapter.addCruise(second)
    expect(await adapter.fetchCruise(first.sourceRef)).toEqual(first)
    expect(await adapter.fetchCruise(second.sourceRef)).toEqual(second)
  })

  it("returns seeded sailing via fetchSailing", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    expect(await adapter.fetchSailing(seedSailing.sourceRef)).toEqual(seedSailing)
  })

  it("returns seeded ship via fetchShip", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addShip(seedShip)
    expect(await adapter.fetchShip(seedShip.sourceRef)).toEqual(seedShip)
  })

  it("listSailingsForCruise returns the seeded sailings", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    expect(await adapter.listSailingsForCruise(seedCruise.sourceRef)).toEqual([seedSailing])
  })
})

describe("MockCruiseAdapter — listEntries", () => {
  it("returns summaries for all seeded cruises", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    const result = await adapter.listEntries()
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.name).toBe("Norwegian Fjords")
    expect(result.entries[0]?.earliestDeparture).toBe("2026-06-15")
  })

  it("respects the limit option", async () => {
    const adapter = new MockCruiseAdapter()
    for (let i = 0; i < 5; i++) {
      adapter.addCruise({
        ...seedCruise,
        sourceRef: { externalId: `ext-cru-${i}` },
        slug: `cruise-${i}`,
      })
    }
    const result = await adapter.listEntries({ limit: 2 })
    expect(result.entries).toHaveLength(2)
  })
})

describe("MockCruiseAdapter — pricing + itinerary", () => {
  it("returns seeded pricing rows", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    adapter.setSailingPricing(seedSailing.sourceRef, [
      {
        cabinCategoryRef: { externalId: "cat-A" },
        occupancy: 2,
        currency: "USD",
        pricePerPerson: "1500.00",
        availability: "available",
      },
    ])
    const prices = await adapter.fetchSailingPricing(seedSailing.sourceRef)
    expect(prices).toHaveLength(1)
    expect(prices[0]?.pricePerPerson).toBe("1500.00")
  })

  it("returns seeded itinerary days", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.addCruise(seedCruise, [seedSailing])
    adapter.setSailingItinerary(seedSailing.sourceRef, [
      { dayNumber: 1, portName: "Bergen", isOvernight: false },
      { dayNumber: 2, portName: "Geiranger", isOvernight: false },
    ])
    const days = await adapter.fetchSailingItinerary(seedSailing.sourceRef)
    expect(days).toHaveLength(2)
    expect(days[0]?.portName).toBe("Bergen")
  })
})

describe("MockCruiseAdapter — createBooking", () => {
  it("returns a generated connector booking ref by default", async () => {
    const adapter = new MockCruiseAdapter()
    const result = await adapter.createBooking({
      sailingRef: seedSailing.sourceRef,
      cabinCategoryRef: { externalId: "cat-A" },
      occupancy: 2,
      passengers: [
        { firstName: "Ann", lastName: "Test" },
        { firstName: "Bob", lastName: "Test" },
      ],
      contact: { firstName: "Ann", lastName: "Test" },
    })
    expect(result.connectorBookingRef).toMatch(/^MOCK-\d{6}$/)
    expect(result.connectorStatus).toBe("confirmed")
    expect(adapter.bookingCount).toBe(1)
  })

  it("returns the pre-programmed result when set", async () => {
    const adapter = new MockCruiseAdapter()
    adapter.setBookingResult(
      seedSailing.sourceRef,
      { externalId: "cat-A" },
      {
        connectorBookingRef: "CARRIER-PNR-12345",
        connectorStatus: "deposit_required",
      },
    )
    const result = await adapter.createBooking({
      sailingRef: seedSailing.sourceRef,
      cabinCategoryRef: { externalId: "cat-A" },
      occupancy: 2,
      passengers: [{ firstName: "X", lastName: "Y" }],
      contact: { firstName: "X", lastName: "Y" },
    })
    expect(result.connectorBookingRef).toBe("CARRIER-PNR-12345")
    expect(result.connectorStatus).toBe("deposit_required")
  })
})

describe("MockCruiseAdapter — failure injection", () => {
  it("throws on every nth call when failEveryNthCall is set", async () => {
    const adapter = new MockCruiseAdapter({ failEveryNthCall: 3 })
    adapter.addCruise(seedCruise)
    await adapter.fetchCruise(seedCruise.sourceRef)
    await adapter.fetchCruise(seedCruise.sourceRef)
    await expect(adapter.fetchCruise(seedCruise.sourceRef)).rejects.toThrow(/forced failure/)
  })
})
