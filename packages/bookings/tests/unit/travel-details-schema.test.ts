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

  // Regression for #501: the cross-package `kmsEnvelopeSchema` reference
  // was wrapped with `z.lazy(() => …)` to defer dereferencing until parse
  // time so chunk-splitting bundlers (Vite/Rolldown) don't trip on a TDZ
  // for the producer chunk. The wrap is only meaningful if the inner
  // schema is actually invoked when an envelope payload is supplied —
  // optional()/nullable() short-circuit on null/undefined and would mask
  // a broken lazy.
  describe("envelope payload still parses through the z.lazy wrap (#501)", () => {
    it("accepts a well-formed kms envelope on every encrypted field", () => {
      const env = { enc: "ciphertext-bytes" }
      const result = bookingTravelerTravelDetailInsertSchema.parse({
        travelerId: "bkpt_abc",
        identityEncrypted: env,
        dietaryEncrypted: env,
        accessibilityEncrypted: env,
        isLeadTraveler: false,
      })
      expect(result.identityEncrypted).toEqual(env)
      expect(result.dietaryEncrypted).toEqual(env)
      expect(result.accessibilityEncrypted).toEqual(env)
    })

    it("rejects a malformed envelope (wrong shape) on the encrypted fields", () => {
      // The lazy wrap must still enforce the producer's validation —
      // an empty `enc` violates the producer's `min(1)` and should fail
      // exactly as it would with a direct (non-lazy) reference.
      expect(() =>
        bookingTravelerTravelDetailInsertSchema.parse({
          travelerId: "bkpt_abc",
          identityEncrypted: { enc: "" },
          isLeadTraveler: false,
        }),
      ).toThrow()
    })
  })
})
