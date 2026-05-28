import { describe, expect, it } from "vitest"

import type {
  CreateExternalBookingInput,
  ExternalBookingResult,
  SourceRef,
} from "../../src/adapters/index.js"
import {
  assertCruiseAdapterCompatibility,
  validateCruiseAdapterCompatibility,
} from "../../src/adapters/index.js"
import { MockCruiseAdapter } from "../../src/adapters/mock.js"

const primaryCruiseRef = {
  externalId: "shared-cruise-id",
  connectionId: "connection-a",
  source: "catalog-a",
}

const alternateCruiseRef = {
  externalId: "shared-cruise-id",
  connectionId: "connection-b",
  source: "catalog-a",
}

const shipRef = {
  externalId: "ship-1",
  connectionId: "connection-a",
  source: "catalog-a",
}

const sailingRef = {
  externalId: "sailing-1",
  connectionId: "connection-a",
  source: "catalog-a",
}

const cabinCategoryRef = {
  externalId: "cat-balcony",
  connectionId: "connection-a",
  source: "catalog-a",
}

const bookingInput: CreateExternalBookingInput = {
  sailingRef,
  cabinCategoryRef,
  occupancy: 2,
  passengerComposition: { adults: 1, children: 1, childAges: [10] },
  fareCode: "FLEX",
  passengers: [
    {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      travelerCategory: "adult",
      isPrimary: true,
    },
    {
      firstName: "Grace",
      lastName: "Hopper",
      travelerCategory: "child",
    },
  ],
  contact: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
  },
  bookingTerms: {
    cancellationPolicy: { summary: "Sandbox terms" },
  },
}

class RecordingMockCruiseAdapter extends MockCruiseAdapter {
  lastBookingInput: CreateExternalBookingInput | null = null

  async createBooking(input: CreateExternalBookingInput): Promise<ExternalBookingResult> {
    this.lastBookingInput = input
    return super.createBooking(input)
  }
}

class ExternalIdOnlyAdapter extends RecordingMockCruiseAdapter {
  async fetchCruise(ref: SourceRef) {
    if (ref.externalId === primaryCruiseRef.externalId) {
      return super.fetchCruise(primaryCruiseRef)
    }
    return super.fetchCruise(ref)
  }
}

class MissingDetailMethodsAdapter extends RecordingMockCruiseAdapter {
  async fetchSailingItinerary() {
    throw new Error("itinerary not implemented")
  }

  async listSailingsForCruise() {
    throw new Error("sailings not implemented")
  }
}

function makeAdapter(Adapter = RecordingMockCruiseAdapter): RecordingMockCruiseAdapter {
  const adapter = new Adapter({ name: "compat-fixture" })
  adapter.addShip({
    sourceRef: shipRef,
    name: "MV Fixture",
    slug: "mv-fixture",
    shipType: "ocean",
    categories: [
      {
        sourceRef: cabinCategoryRef,
        code: "BAL",
        name: "Balcony",
        roomType: "balcony",
        minOccupancy: 1,
        maxOccupancy: 4,
      },
    ],
  })
  adapter.addCruise(
    {
      sourceRef: primaryCruiseRef,
      name: "Primary Fixture Cruise",
      slug: "primary-fixture-cruise",
      cruiseType: "ocean",
      lineName: "Fixture Line",
      defaultShipRef: shipRef,
      nights: 7,
      status: "live",
    },
    [
      {
        sourceRef: sailingRef,
        cruiseRef: primaryCruiseRef,
        shipRef,
        departureDate: "2027-07-01",
        returnDate: "2027-07-08",
        salesStatus: "open",
      },
    ],
  )
  adapter.addCruise({
    sourceRef: alternateCruiseRef,
    name: "Alternate Fixture Cruise",
    slug: "alternate-fixture-cruise",
    cruiseType: "ocean",
    lineName: "Fixture Line",
    defaultShipRef: shipRef,
    nights: 7,
    status: "live",
  })
  adapter.setSailingPricing(sailingRef, [
    {
      cabinCategoryRef,
      occupancy: 2,
      passengerComposition: { adults: 1, children: 1, childAges: [10] },
      fareCode: "FLEX",
      currency: "USD",
      pricePerPerson: "1200.00",
      availability: "available",
    },
  ])
  adapter.setSailingItinerary(sailingRef, [
    {
      dayNumber: 1,
      title: "Embarkation",
      portName: "Athens",
      departureTime: "17:00",
    },
    {
      dayNumber: 2,
      title: "At sea",
      isSeaDay: true,
    },
  ])
  adapter.setBookingResult(sailingRef, cabinCategoryRef, {
    connectorBookingRef: "SANDBOX-123",
    connectorStatus: "confirmed",
  })
  return adapter
}

describe("CruiseAdapter compatibility fixture", () => {
  it("validates full SourceRef identity, pricing lookup, details, and booking payloads", async () => {
    const adapter = makeAdapter()

    await assertCruiseAdapterCompatibility(adapter, {
      primaryCruiseRef,
      alternateCruiseRef,
      sailingRef,
      shipRef,
      cabinCategoryRef,
      minimumItineraryDays: 2,
      passengerComposition: { adults: 1, children: 1, childAges: [10] },
      fareCode: "FLEX",
      bookingInput,
    })

    expect(adapter.lastBookingInput).toEqual(bookingInput)
  })

  it("flags adapters that collapse same-externalId refs across connections", async () => {
    const adapter = makeAdapter(ExternalIdOnlyAdapter)

    const report = await validateCruiseAdapterCompatibility(adapter, {
      primaryCruiseRef,
      alternateCruiseRef,
      sailingRef,
      shipRef,
      cabinCategoryRef,
      minimumItineraryDays: 2,
      passengerComposition: { adults: 1, children: 1, childAges: [10] },
      fareCode: "FLEX",
      bookingInput,
    })

    expect(report.ok).toBe(false)
    expect(
      report.checks.some(
        (check) => check.name === "sourceRef.multiConnection.fetchCruise" && !check.passed,
      ),
    ).toBe(true)
  })

  it("flags adapters that do not implement required sailing and itinerary detail reads", async () => {
    const adapter = makeAdapter(MissingDetailMethodsAdapter)

    const report = await validateCruiseAdapterCompatibility(adapter, {
      primaryCruiseRef,
      alternateCruiseRef,
      sailingRef,
      shipRef,
      cabinCategoryRef,
      minimumItineraryDays: 2,
      passengerComposition: { adults: 1, children: 1, childAges: [10] },
      fareCode: "FLEX",
      bookingInput,
    })

    expect(report.ok).toBe(false)
    expect(
      report.checks.some((check) => check.name === "detail.listSailingsForCruise" && !check.passed),
    ).toBe(true)
    expect(
      report.checks.some((check) => check.name === "detail.fetchSailingItinerary" && !check.passed),
    ).toBe(true)
  })
})
