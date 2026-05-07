import { describe, expect, it } from "vitest"

import {
  bookingTravelerTravelDetailInsertSchema,
  bookingTravelerTravelDetailSelectSchema,
  decryptedBookingTravelerTravelDetailSchema,
} from "../../src/schema/travel-details.js"

describe("traveler travel detail schema aliases", () => {
  it("parses traveler insert input with travelerId", () => {
    const result = bookingTravelerTravelDetailInsertSchema.parse({
      travelerId: "bkpt_abc",
      isLeadTraveler: true,
    })

    expect(result).toEqual({
      travelerId: "bkpt_abc",
      identityEncrypted: undefined,
      dietaryEncrypted: undefined,
      isLeadTraveler: true,
    })
  })

  it("parses select output with travelerId", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const result = bookingTravelerTravelDetailSelectSchema.parse({
      travelerId: "bkpt_abc",
      identityEncrypted: null,
      dietaryEncrypted: null,
      isLeadTraveler: false,
      createdAt: now,
      updatedAt: now,
    })

    expect(result).toEqual({
      travelerId: "bkpt_abc",
      identityEncrypted: null,
      dietaryEncrypted: null,
      isLeadTraveler: false,
      createdAt: now,
      updatedAt: now,
    })
  })

  it("parses decrypted output with travelerId", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const result = decryptedBookingTravelerTravelDetailSchema.parse({
      travelerId: "bkpt_abc",
      nationality: "RO",
      passportNumber: null,
      passportExpiry: null,
      passportIssuingCountry: null,
      passportIssuingAuthority: null,
      passportPersonDocumentId: null,
      dateOfBirth: "1990-02-03",
      dietaryRequirements: null,
      accessibilityNeeds: null,
      isLeadTraveler: false,
      createdAt: now,
      updatedAt: now,
    })

    expect(result).toEqual({
      travelerId: "bkpt_abc",
      nationality: "RO",
      passportNumber: null,
      passportExpiry: null,
      passportIssuingCountry: null,
      passportIssuingAuthority: null,
      passportPersonDocumentId: null,
      dateOfBirth: "1990-02-03",
      dietaryRequirements: null,
      accessibilityNeeds: null,
      isLeadTraveler: false,
      createdAt: now,
      updatedAt: now,
    })
  })
})
