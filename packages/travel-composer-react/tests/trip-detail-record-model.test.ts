import { describe, expect, it } from "vitest"

import {
  formatContactName,
  formatPersonName,
  readBilling,
  readTravelers,
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
})
