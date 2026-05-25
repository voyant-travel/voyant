import { afterEach, describe, expect, it, vi } from "vitest"

import type { BookingPiiService, UpsertBookingTravelerTravelDetailInput } from "../../src/pii.js"
import { bookingsService } from "../../src/service.js"

interface FakePiiCall {
  travelerId: string
  input: UpsertBookingTravelerTravelDetailInput
  actorId: string | null | undefined
}

function makeFakePii(): { service: BookingPiiService; calls: FakePiiCall[] } {
  const calls: FakePiiCall[] = []
  const service: BookingPiiService = {
    async upsertTravelerTravelDetails(_db, travelerId, input, actorId) {
      calls.push({ travelerId, input, actorId })
      return {
        travelerId,
        nationality: input.nationality ?? null,
        documentType: input.documentType ?? null,
        documentNumber: input.documentNumber ?? null,
        documentExpiry: input.documentExpiry ?? null,
        documentIssuingCountry: input.documentIssuingCountry ?? null,
        documentIssuingAuthority: input.documentIssuingAuthority ?? null,
        documentPersonDocumentId: input.documentPersonDocumentId ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        dietaryRequirements: input.dietaryRequirements ?? null,
        accessibilityNeeds: input.accessibilityNeeds ?? null,
        isLeadTraveler: input.isLeadTraveler ?? false,
        sharingGroupId: input.sharingGroupId ?? null,
        roomTypeId: input.roomTypeId ?? null,
        bedPreference: input.bedPreference ?? null,
        allocations: input.allocations ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    },
    async getTravelerTravelDetails() {
      return null
    },
    async deleteTravelerTravelDetails(_db, travelerId) {
      return { travelerId }
    },
  }
  return { service, calls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("bookingsService.createTravelerWithTravelDetails", () => {
  it("forwards plaintext fields to createTravelerRecord and encrypted fields to pii.upsertTravelerTravelDetails", async () => {
    const fakeRow = {
      id: "bkps_01HZA0000000000000000001",
      bookingId: "book_x",
      personId: null,
      participantType: "traveler",
      travelerCategory: null,
      firstName: "Ana",
      lastName: "Traveler",
      email: "ana@example.com",
      phone: "+40700000001",
      preferredLanguage: null,
      specialRequests: null,
      isPrimary: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const createSpy = vi
      .spyOn(bookingsService, "createTravelerRecord")
      // biome-ignore lint/suspicious/noExplicitAny: spy return narrowing
      .mockResolvedValue(fakeRow as any)

    const { service: pii, calls } = makeFakePii()
    const fakeDb = {} as never

    const result = await bookingsService.createTravelerWithTravelDetails(
      fakeDb,
      "book_x",
      {
        participantType: "traveler",
        firstName: "Ana",
        lastName: "Traveler",
        email: "ana@example.com",
        phone: "+40700000001",
        nationality: "RO",
        documentNumber: "ABC123",
        accessibilityNeeds: "wheelchair access",
        isLeadTraveler: true,
      },
      { pii, userId: "u_1", actorId: "u_1" },
    )

    expect(createSpy).toHaveBeenCalledTimes(1)
    const createArgs = createSpy.mock.calls[0]
    expect(createArgs?.[1]).toBe("book_x")
    // plaintext payload — encrypted keys must NOT leak through
    expect(createArgs?.[2]).toMatchObject({
      participantType: "traveler",
      firstName: "Ana",
      lastName: "Traveler",
      email: "ana@example.com",
      phone: "+40700000001",
    })
    expect(createArgs?.[2]).not.toHaveProperty("nationality")
    expect(createArgs?.[2]).not.toHaveProperty("accessibilityNeeds")
    expect(createArgs?.[3]).toBe("u_1")

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      travelerId: fakeRow.id,
      input: {
        nationality: "RO",
        documentType: undefined,
        documentNumber: "ABC123",
        documentExpiry: undefined,
        documentIssuingCountry: undefined,
        documentIssuingAuthority: undefined,
        documentPersonDocumentId: undefined,
        dateOfBirth: undefined,
        dietaryRequirements: undefined,
        accessibilityNeeds: "wheelchair access",
        isLeadTraveler: true,
        sharingGroupId: undefined,
        roomTypeId: undefined,
        bedPreference: undefined,
        allocations: undefined,
      },
      actorId: "u_1",
    })

    expect(result?.traveler).toEqual(fakeRow)
    expect(result?.travelDetails?.documentNumber).toBe("ABC123")
    expect(result?.travelDetails?.accessibilityNeeds).toBe("wheelchair access")
  })

  it("returns null when createTravelerRecord returns null (booking not found)", async () => {
    const createSpy = vi.spyOn(bookingsService, "createTravelerRecord").mockResolvedValue(null)
    const { service: pii, calls } = makeFakePii()

    const result = await bookingsService.createTravelerWithTravelDetails(
      {} as never,
      "book_unknown",
      { participantType: "traveler", firstName: "X", lastName: "Y" },
      { pii },
    )

    expect(result).toBeNull()
    expect(createSpy).toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it("still upserts an empty encrypted envelope when no encrypted fields are supplied", async () => {
    vi.spyOn(bookingsService, "createTravelerRecord").mockResolvedValue({
      id: "bkps_only_plain",
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub row
    } as any)
    const { service: pii, calls } = makeFakePii()

    await bookingsService.createTravelerWithTravelDetails(
      {} as never,
      "book_x",
      { participantType: "traveler", firstName: "Bo", lastName: "Traveler" },
      { pii },
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.input).toEqual({
      nationality: undefined,
      documentType: undefined,
      documentNumber: undefined,
      documentExpiry: undefined,
      documentIssuingCountry: undefined,
      documentIssuingAuthority: undefined,
      documentPersonDocumentId: undefined,
      dateOfBirth: undefined,
      dietaryRequirements: undefined,
      accessibilityNeeds: undefined,
      isLeadTraveler: undefined,
      sharingGroupId: undefined,
      roomTypeId: undefined,
      bedPreference: undefined,
      allocations: undefined,
    })
  })
})

describe("bookingsService.updateTravelerWithTravelDetails", () => {
  it("forwards plaintext partial to updateTravelerRecord and encrypted partial to pii.upsertTravelerTravelDetails", async () => {
    const fakeRow = {
      id: "bkps_01HZA0000000000000000002",
      bookingId: "book_x",
      firstName: "Renamed",
      lastName: "Traveler",
      email: "initial@example.com",
    }
    const updateSpy = vi
      .spyOn(bookingsService, "updateTravelerRecord")
      // biome-ignore lint/suspicious/noExplicitAny: spy return narrowing
      .mockResolvedValue(fakeRow as any)

    const { service: pii, calls } = makeFakePii()

    const result = await bookingsService.updateTravelerWithTravelDetails(
      {} as never,
      "bkps_01HZA0000000000000000002",
      { firstName: "Renamed", documentNumber: "NEW-12345" },
      { pii, actorId: "u_42" },
    )

    expect(updateSpy).toHaveBeenCalledTimes(1)
    const updateArgs = updateSpy.mock.calls[0]
    expect(updateArgs?.[1]).toBe("bkps_01HZA0000000000000000002")
    expect(updateArgs?.[2]).toMatchObject({
      firstName: "Renamed",
    })
    expect(updateArgs?.[2]).not.toHaveProperty("documentNumber")
    expect(updateArgs?.[2]).not.toHaveProperty("nationality")

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      travelerId: fakeRow.id,
      input: {
        nationality: undefined,
        documentType: undefined,
        documentNumber: "NEW-12345",
        documentExpiry: undefined,
        documentIssuingCountry: undefined,
        documentIssuingAuthority: undefined,
        documentPersonDocumentId: undefined,
        dateOfBirth: undefined,
        dietaryRequirements: undefined,
        accessibilityNeeds: undefined,
        isLeadTraveler: undefined,
        sharingGroupId: undefined,
        roomTypeId: undefined,
        bedPreference: undefined,
        allocations: undefined,
      },
      actorId: "u_42",
    })

    expect(result?.traveler).toEqual(fakeRow)
    expect(result?.travelDetails?.documentNumber).toBe("NEW-12345")
  })

  it("preserves undefined-vs-null distinction for encrypted fields (undefined → preserve, null → clear)", async () => {
    vi.spyOn(bookingsService, "updateTravelerRecord").mockResolvedValue({
      id: "bkps_x",
      // biome-ignore lint/suspicious/noExplicitAny: minimal stub row
    } as any)
    const { service: pii, calls } = makeFakePii()

    await bookingsService.updateTravelerWithTravelDetails(
      {} as never,
      "bkps_x",
      { documentNumber: null }, // explicit clear
      { pii },
    )

    expect(calls[0]?.input).toEqual({
      nationality: undefined, // preserve existing
      documentType: undefined,
      documentNumber: null, // clear
      documentExpiry: undefined,
      documentIssuingCountry: undefined,
      documentIssuingAuthority: undefined,
      documentPersonDocumentId: undefined,
      dateOfBirth: undefined,
      dietaryRequirements: undefined,
      accessibilityNeeds: undefined,
      isLeadTraveler: undefined,
      sharingGroupId: undefined,
      roomTypeId: undefined,
      bedPreference: undefined,
      allocations: undefined,
    })
  })

  it("returns null when updateTravelerRecord returns null (traveler not found)", async () => {
    vi.spyOn(bookingsService, "updateTravelerRecord").mockResolvedValue(null)
    const { service: pii, calls } = makeFakePii()

    const result = await bookingsService.updateTravelerWithTravelDetails(
      {} as never,
      "bkps_unknown",
      { firstName: "Nope" },
      { pii },
    )

    expect(result).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
