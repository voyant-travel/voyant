import { describe, expect, it } from "vitest"

import {
  redactBookingContact,
  redactEmail,
  redactPhone,
  redactString,
  redactTravelerIdentity,
  shouldRevealBookingPii,
} from "../../src/pii-redaction.js"

describe("shouldRevealBookingPii()", () => {
  it("reveals on internal requests regardless of scopes", () => {
    expect(shouldRevealBookingPii({ isInternalRequest: true })).toBe(true)
    expect(shouldRevealBookingPii({ isInternalRequest: true, scopes: [] })).toBe(true)
  })

  it("reveals when scope includes superuser '*' or 'bookings-pii:read' or 'bookings-pii:*'", () => {
    expect(shouldRevealBookingPii({ scopes: ["*"] })).toBe(true)
    expect(shouldRevealBookingPii({ scopes: ["bookings-pii:*"] })).toBe(true)
    expect(shouldRevealBookingPii({ scopes: ["bookings-pii:read"] })).toBe(true)
  })

  it("reveals for staff dashboard sessions", () => {
    expect(shouldRevealBookingPii({ actor: "staff", scopes: [] })).toBe(true)
    expect(shouldRevealBookingPii({ actor: "staff", scopes: ["bookings:read"] })).toBe(true)
  })

  it("does NOT reveal for customer / partner / supplier actors", () => {
    expect(shouldRevealBookingPii({ actor: "customer", scopes: [] })).toBe(false)
    expect(shouldRevealBookingPii({ actor: "partner", scopes: ["bookings:read"] })).toBe(false)
  })

  it("does NOT reveal when no scopes/actor at all", () => {
    expect(shouldRevealBookingPii({})).toBe(false)
  })
})

describe("redactEmail()", () => {
  it("masks the local-part but keeps the domain", () => {
    expect(redactEmail("alice@example.com")).toBe("a***e@example.com")
  })

  it("masks short local parts entirely", () => {
    expect(redactEmail("bo@example.com")).toBe("**@example.com")
    expect(redactEmail("a@example.com")).toBe("*@example.com")
  })

  it("returns *** for malformed addresses", () => {
    expect(redactEmail("not-an-email")).toBe("***")
    expect(redactEmail("@example.com")).toBe("***")
  })

  it("preserves null and undefined", () => {
    expect(redactEmail(null)).toBeNull()
    expect(redactEmail(undefined)).toBeNull()
  })
})

describe("redactPhone()", () => {
  it("keeps the last four digits", () => {
    expect(redactPhone("+40 712 345 678")).toBe("***5678")
    expect(redactPhone("0712345678")).toBe("***5678")
  })

  it("returns *** for short values", () => {
    expect(redactPhone("123")).toBe("***")
    expect(redactPhone("1234")).toBe("***")
  })

  it("preserves null and undefined", () => {
    expect(redactPhone(null)).toBeNull()
    expect(redactPhone(undefined)).toBeNull()
  })
})

describe("redactString()", () => {
  it("masks any non-empty string with ***", () => {
    expect(redactString("Bucharest")).toBe("***")
  })

  it("preserves empty strings (so client schemas don't break)", () => {
    expect(redactString("")).toBe("")
  })

  it("preserves null and undefined", () => {
    expect(redactString(null)).toBeNull()
    expect(redactString(undefined)).toBeNull()
  })
})

describe("redactBookingContact()", () => {
  it("masks contactFirstName/Last/Email/Phone/Address/PostalCode and leaves other fields alone", () => {
    const input = {
      id: "book_1",
      bookingNumber: "BK-1",
      status: "confirmed" as const,
      contactFirstName: "Alice",
      contactLastName: "Smith",
      contactTaxId: "RO12345678",
      contactEmail: "alice@example.com",
      contactPhone: "+40712345678",
      contactAddressLine1: "Str. Lipscani 1",
      contactAddressLine2: "Ap. 4",
      contactPostalCode: "030031",
      contactCity: "Bucharest",
    }
    const output = redactBookingContact(input)
    expect(output.id).toBe("book_1")
    expect(output.bookingNumber).toBe("BK-1")
    expect(output.status).toBe("confirmed")
    expect(output.contactFirstName).toBe("***")
    expect(output.contactLastName).toBe("***")
    expect(output.contactTaxId).toBe("***")
    expect(output.contactEmail).toBe("a***e@example.com")
    expect(output.contactPhone).toBe("***5678")
    expect(output.contactAddressLine1).toBe("***")
    expect(output.contactAddressLine2).toBe("***")
    expect(output.contactPostalCode).toBe("***")
    // contactCity is NOT in the redaction set — it's coarse-grained
    expect((output as unknown as { contactCity: string }).contactCity).toBe("Bucharest")
  })

  it("passes nulls through", () => {
    const input = {
      id: "book_1",
      contactFirstName: null,
      contactLastName: null,
      contactTaxId: null,
      contactEmail: null,
      contactPhone: null,
      contactAddressLine1: null,
      contactAddressLine2: null,
      contactPostalCode: null,
    }
    const output = redactBookingContact(input)
    expect(output.contactTaxId).toBeNull()
    expect(output.contactEmail).toBeNull()
    expect(output.contactPhone).toBeNull()
  })
})

describe("redactTravelerIdentity()", () => {
  it("masks identity columns + specialRequests/notes (accessibility lives in the encrypted bucket)", () => {
    const input = {
      id: "bkpt_1",
      bookingId: "book_1",
      participantType: "traveler" as const,
      firstName: "Mihai",
      lastName: "Popa",
      email: "mihai@example.com",
      phone: "+40712345678",
      specialRequests: "kosher meal",
      notes: "VIP guest",
      isPrimary: true,
    }
    const output = redactTravelerIdentity(input)
    expect(output.firstName).toBe("***")
    expect(output.lastName).toBe("***")
    expect(output.email).toBe("m***i@example.com")
    expect(output.phone).toBe("***5678")
    expect(output.specialRequests).toBe("***")
    expect(output.notes).toBe("***")
    // Untouched
    expect(output.id).toBe("bkpt_1")
    expect(output.participantType).toBe("traveler")
    expect(output.isPrimary).toBe(true)
  })
})
