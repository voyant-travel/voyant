import { describe, expect, it } from "vitest"

import {
  formatContactName,
  formatPersonName,
  readBilling,
  readTravelers,
  summarizeTripComponentValues,
} from "../src/admin/trip-detail-record-model.js"

describe("trip detail record model", () => {
  it("reads billing and traveler records from traveler party metadata", () => {
    const travelerParty = {
      billing: {
        buyerType: "B2C",
        personId: "per_1",
        contact: { firstName: "Ana", lastName: "Pop", email: "ana@example.com", phone: "" },
      },
      travelers: [
        { localId: "lead", personId: "per_1", firstName: "Ana", lastName: "Pop", role: "lead" },
        null,
        { firstName: "Mihai", email: "mihai@example.com", role: "adult" },
      ],
    }

    expect(readBilling(travelerParty)).toEqual({
      buyerType: "B2C",
      personId: "per_1",
      organizationId: undefined,
      contact: {
        firstName: "Ana",
        lastName: "Pop",
        email: "ana@example.com",
        phone: undefined,
      },
    })
    expect(readTravelers(travelerParty)).toEqual([
      {
        localId: "lead",
        personId: "per_1",
        firstName: "Ana",
        lastName: "Pop",
        email: undefined,
        role: "lead",
      },
      {
        localId: undefined,
        personId: null,
        firstName: "Mihai",
        lastName: undefined,
        email: "mihai@example.com",
        role: "adult",
      },
    ])
  })

  it("formats person and contact names with email fallbacks", () => {
    expect(formatPersonName({ firstName: "Ana", lastName: "Pop", email: "ana@example.com" })).toBe(
      "Ana Pop",
    )
    expect(formatPersonName({ firstName: "", lastName: "", email: "fallback@example.com" })).toBe(
      "fallback@example.com",
    )
    expect(
      formatContactName({ firstName: "Only", lastName: "", email: "ignored@example.com" }),
    ).toBe("Only")
  })

  it("separates active and cancelled component values", () => {
    const values = summarizeTripComponentValues(
      [
        {
          status: "booked",
          componentCurrency: "EUR",
          componentSubtotalAmountCents: 10000,
          componentTaxAmountCents: 900,
          componentTotalAmountCents: 10900,
        },
        {
          status: "cancelled",
          componentCurrency: "EUR",
          componentSubtotalAmountCents: 20000,
          componentTaxAmountCents: 1800,
          componentTotalAmountCents: 21800,
        },
        {
          status: "removed",
          componentCurrency: "EUR",
          componentSubtotalAmountCents: 30000,
          componentTaxAmountCents: 2700,
          componentTotalAmountCents: 32700,
        },
      ],
      "EUR",
    )

    expect(values.active).toEqual({
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
      componentCount: 1,
      valuedComponentCount: 1,
    })
    expect(values.cancelled).toEqual({
      currency: "EUR",
      subtotalAmountCents: 20000,
      taxAmountCents: 1800,
      totalAmountCents: 21800,
      componentCount: 1,
      valuedComponentCount: 1,
    })
  })
})
