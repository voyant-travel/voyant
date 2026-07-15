import { describe, expect, it } from "vitest"

import {
  toPublicOperatorProfile,
  updateOperatorPaymentDefaultsSchema,
  updateOperatorProfileSchema,
} from "./service.js"

// Minimal row shape the DTO mapper reads (the full row also has id/timestamps).
function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "oppf_test",
    name: "Acme Tours",
    legalName: "Acme Tours SRL",
    vatId: null,
    registrationNumber: null,
    address: "1 Main St",
    phone: "+40 700 000 000",
    email: "hello@acme.test",
    website: "https://acme.test",
    license: "ANPC-123",
    licenseAuthority: "ANPC",
    signatoryName: null,
    signatoryRole: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as Parameters<typeof toPublicOperatorProfile>[0]
}

describe("toPublicOperatorProfile", () => {
  it("maps profile + payment defaults into the public DTO", () => {
    const dto = toPublicOperatorProfile(profileRow(), {
      id: "opdp_test",
      customerPaymentPolicy: {
        deposit: { kind: "none" },
        minDaysBeforeDepartureForDeposit: 0,
        balanceDueDaysBeforeDeparture: 0,
        balanceDueMinDaysFromNow: 0,
      },
      bookingCheckoutUrlTemplate: "https://pay.acme.test/{booking}",
      invoicePayUrlTemplate: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as Parameters<typeof toPublicOperatorProfile>[1])

    expect(dto.name).toBe("Acme Tours")
    expect(dto.email).toBe("hello@acme.test")
    expect(dto.bookingCheckoutUrlTemplate).toBe("https://pay.acme.test/{booking}")
    expect(dto.invoicePayUrlTemplate).toBeNull()
    expect(dto.customerPaymentPolicy).toEqual({
      deposit: { kind: "none" },
      minDaysBeforeDepartureForDeposit: 0,
      balanceDueDaysBeforeDeparture: 0,
      balanceDueMinDaysFromNow: 0,
    })
  })

  it("coalesces missing identity fields to empty strings and policy to null", () => {
    const dto = toPublicOperatorProfile(
      profileRow({ name: null, email: null, website: null, license: null }),
    )
    expect(dto.name).toBe("")
    expect(dto.email).toBe("")
    expect(dto.website).toBe("")
    expect(dto.license).toBe("")
    expect(dto.customerPaymentPolicy).toBeNull()
    expect(dto.bookingCheckoutUrlTemplate).toBeNull()
  })

  it("rejects malformed stored payment policies at the service boundary", () => {
    expect(() =>
      toPublicOperatorProfile(profileRow(), {
        id: "opdp_invalid",
        customerPaymentPolicy: { deposit: { kind: "none" } },
        bookingCheckoutUrlTemplate: null,
        invoicePayUrlTemplate: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      } as Parameters<typeof toPublicOperatorProfile>[1]),
    ).toThrow()
  })
})

describe("validation schemas", () => {
  it("accepts a valid profile patch and an empty email/website", () => {
    expect(updateOperatorProfileSchema.safeParse({ name: "X", email: "" }).success).toBe(true)
    expect(updateOperatorProfileSchema.safeParse({ email: "a@b.test" }).success).toBe(true)
  })

  it("rejects a malformed email", () => {
    expect(updateOperatorProfileSchema.safeParse({ email: "not-an-email" }).success).toBe(false)
  })

  it("validates the customer payment policy shape", () => {
    expect(
      updateOperatorPaymentDefaultsSchema.safeParse({
        customerPaymentPolicy: {
          deposit: { kind: "percent", percent: 20 },
          minDaysBeforeDepartureForDeposit: 0,
          balanceDueDaysBeforeDeparture: 30,
          balanceDueMinDaysFromNow: 7,
        },
      }).success,
    ).toBe(true)

    expect(
      updateOperatorPaymentDefaultsSchema.safeParse({
        customerPaymentPolicy: { deposit: { kind: "bogus" } },
      }).success,
    ).toBe(false)
  })
})
