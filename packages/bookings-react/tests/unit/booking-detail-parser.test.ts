import { describe, expect, it } from "vitest"

import { bookingListResponse, bookingSingleResponse } from "../../src/schemas.js"

// Regression cover for voyant#2728: the admin booking detail read hydrates
// items/travelers/documents inline, but the client previously parsed the
// response with the flat list record schema, which stripped those collections.
// `bookingSingleResponse` now points at `bookingDetailSchema`, so the parser
// must preserve them while the list parser stays on the summary shape.

const baseBooking = {
  id: "bkg_1",
  bookingNumber: "B-0001",
  status: "confirmed",
  personId: null,
  organizationId: null,
  sellCurrency: "EUR",
  sellAmountCents: 10000,
  costAmountCents: 6000,
  marginPercent: 40,
  startDate: null,
  endDate: null,
  pax: 2,
  internalNotes: null,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
}

const detailItem = {
  id: "bkit_1",
  bookingId: "bkg_1",
  title: "Guided tour",
  description: null,
  itemType: "unit",
  status: "confirmed",
  serviceDate: null,
  startsAt: null,
  endsAt: null,
  quantity: 2,
  sellCurrency: "EUR",
  unitSellAmountCents: 5000,
  totalSellAmountCents: 10000,
  costCurrency: "EUR",
  unitCostAmountCents: 3000,
  totalCostAmountCents: 6000,
  notes: null,
  productId: "prod_1",
  optionId: null,
  optionUnitId: null,
  pricingCategoryId: null,
  availabilitySlotId: null,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
}

const traveler = {
  id: "bktr_1",
  bookingId: "bkg_1",
  participantType: "adult",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  specialRequests: null,
  isPrimary: true,
  notes: null,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
}

const document = {
  id: "bkdoc_1",
  bookingId: "bkg_1",
  travelerId: null,
  type: "insurance",
  fileName: "policy.pdf",
  fileUrl: "https://example.com/policy.pdf",
  expiresAt: null,
  notes: null,
  createdAt: "2026-07-02T00:00:00.000Z",
}

describe("bookingSingleResponse (detail parser)", () => {
  it("preserves hydrated items, travelers, and documents", () => {
    const parsed = bookingSingleResponse.parse({
      data: { ...baseBooking, items: [detailItem], travelers: [traveler], documents: [document] },
    })

    expect(parsed.data.items).toHaveLength(1)
    expect(parsed.data.items[0]).toMatchObject({ id: "bkit_1", status: "confirmed" })
    expect(parsed.data.travelers).toHaveLength(1)
    expect(parsed.data.travelers[0]).toMatchObject({ id: "bktr_1", firstName: "Ada" })
    expect(parsed.data.documents).toHaveLength(1)
    expect(parsed.data.documents[0]).toMatchObject({ id: "bkdoc_1", type: "insurance" })
  })

  it("accepts a revealed traveler carrying travelDetails without stripping it", () => {
    const revealed = {
      ...traveler,
      travelDetails: {
        travelerId: "bktr_1",
        nationality: "GB",
        documentType: "passport",
        documentNumber: "X123",
        documentExpiry: null,
        documentIssuingCountry: "GB",
        documentIssuingAuthority: null,
        documentPersonDocumentId: null,
        dateOfBirth: null,
        dietaryRequirements: null,
        accessibilityNeeds: null,
        isLeadTraveler: true,
        sharingGroupId: null,
        roomTypeId: null,
        bedPreference: null,
        allocations: {},
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },
    }

    const parsed = bookingSingleResponse.parse({
      data: { ...baseBooking, items: [], travelers: [revealed], documents: [] },
    })

    expect(parsed.data.travelers[0]).toHaveProperty("travelDetails")
    expect(
      (parsed.data.travelers[0] as { travelDetails: { nationality: string } }).travelDetails
        .nationality,
    ).toBe("GB")
  })

  it("keeps the list parser on the summary shape (no travelers/documents required)", () => {
    const parsed = bookingListResponse.parse({
      data: [
        {
          ...baseBooking,
          items: [{ id: "bkit_1", title: "Guided tour", itemType: "product", productId: "prod_1" }],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })

    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0]).not.toHaveProperty("travelers")
  })
})
