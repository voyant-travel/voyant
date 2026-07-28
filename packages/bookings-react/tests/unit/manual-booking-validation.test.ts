import { describe, expect, it, vi } from "vitest"

import {
  formatManualBookingAmount,
  validateManualBookingDraft,
} from "../../src/components/manual-booking-create-form.js"
import { bookingsUiEn } from "../../src/i18n/en.js"

const valid = {
  productId: "prod_1",
  billing: {
    billTo: "person" as const,
    mode: "existing" as const,
    personId: "person_1",
    newPerson: { firstName: "", lastName: "", email: "", phone: "" },
    organizationId: null,
  },
  contactFirstName: "Ana",
  contactLastName: "Pop",
  contactEmail: "ana@example.com",
  travelers: {
    travelers: [
      {
        clientTravelerKey: "trav:1",
        personId: null,
        firstName: "Ana",
        lastName: "Pop",
        email: "ana@example.com",
        phone: "",
        preferredLanguage: "ro",
        role: "lead" as const,
        dateOfBirth: null,
        pricingUnitId: null,
        pricingCategoryId: null,
        inventoryUnitId: null,
      },
    ],
  },
  sellAmount: "125.00",
  paymentEnabled: true,
  paymentRows: [{ dueDate: "2027-01-10", amountCents: 12_500 }],
  messages: bookingsUiEn.manualBookingCreate,
}

describe("manual booking validation", () => {
  it("formats minor-unit amounts as major currency units", () => {
    const formatter = vi.fn((value: number) => String(value))

    expect(formatManualBookingAmount(125_000, "EUR", formatter)).toBe("1250")
    expect(formatter).toHaveBeenCalledWith(1250, "EUR", { currencyDisplay: "code" })
  })

  it("accepts a complete individual booking", () => {
    expect(validateManualBookingDraft(valid)).toBeNull()
  })

  it("requires the selected organization in organization billing mode", () => {
    expect(
      validateManualBookingDraft({
        ...valid,
        billing: { ...valid.billing, billTo: "organization", personId: "" },
      }),
    ).toBe(bookingsUiEn.manualBookingCreate.validation.organization)
  })

  it("rejects invalid contact, traveler, lead, amount, and payment state", () => {
    expect(validateManualBookingDraft({ ...valid, contactEmail: "invalid" })).toBe(
      bookingsUiEn.manualBookingCreate.validation.email,
    )
    expect(
      validateManualBookingDraft({
        ...valid,
        travelers: {
          travelers: [{ ...valid.travelers.travelers[0]!, lastName: "" }],
        },
      }),
    ).toBe(bookingsUiEn.manualBookingCreate.validation.travelerNames)
    expect(
      validateManualBookingDraft({
        ...valid,
        travelers: {
          travelers: [{ ...valid.travelers.travelers[0]!, role: "adult" }],
        },
      }),
    ).toBe(bookingsUiEn.manualBookingCreate.validation.leadTraveler)
    expect(validateManualBookingDraft({ ...valid, sellAmount: "-1" })).toBe(
      bookingsUiEn.manualBookingCreate.validation.amount,
    )
    expect(
      validateManualBookingDraft({
        ...valid,
        paymentRows: [{ dueDate: "2027-01-10", amountCents: 100 }],
      }),
    ).toBe(bookingsUiEn.manualBookingCreate.validation.payment)
  })
})
