import { describe, expect, it } from "vitest"

import {
  hydrateBilling,
  hydrateTravelers,
  hydrateVoucher,
  paymentScheduleToRows,
  tripTravelerRoleFromStored,
} from "../src/admin/admin-trip-composer-page-model.js"

describe("admin trip composer page model", () => {
  it("hydrates persisted traveler party fields for composer state", () => {
    const travelerParty = {
      billing: {
        buyerType: "B2B",
        organizationId: "org_123",
        contact: { firstName: "Ana", lastName: "Pop", email: "ana@example.com" },
      },
      travelers: [
        { localId: "lead", firstName: "Ana", lastName: "Pop", email: "ana@example.com" },
        { personId: "per_2", firstName: "Mihai", role: "child" },
      ],
      voucher: {
        id: "vch_1",
        code: "SUMMER",
        currency: "EUR",
        remainingAmountCents: 2500,
      },
    }

    expect(hydrateBilling(travelerParty)).toMatchObject({
      mode: "existing",
      billTo: "organization",
      organizationId: "org_123",
    })
    expect(hydrateTravelers(travelerParty)).toEqual([
      {
        localId: "lead",
        personId: null,
        firstName: "Ana",
        lastName: "Pop",
        email: "ana@example.com",
        dateOfBirth: null,
        role: "lead",
      },
      {
        localId: "tt_existing_1",
        personId: "per_2",
        firstName: "Mihai",
        lastName: "",
        email: "",
        dateOfBirth: null,
        role: "child",
      },
    ])
    expect(hydrateVoucher(travelerParty).picked).toMatchObject({
      id: "vch_1",
      code: "SUMMER",
      remainingAmountCents: 2500,
    })
  })

  it("maps already-paid full schedules into booking draft rows", () => {
    expect(
      paymentScheduleToRows(
        {
          mode: "full",
          installments: [
            {
              dueDate: "2026-07-01",
              amountCents: null,
              alreadyPaid: true,
              paymentDate: "2026-06-15",
              paymentMethod: "card",
              paymentReference: "auth_123",
            },
          ],
        },
        "EUR",
        12000,
      ),
    ).toEqual([
      {
        scheduleType: "balance",
        status: "paid",
        dueDate: "2026-07-01",
        currency: "EUR",
        amountCents: 12000,
        notes: "Marked paid in trip composer; date: 2026-06-15; method: card; reference: auth_123",
      },
    ])
  })

  it("falls back to lead role for the first stored traveler", () => {
    expect(tripTravelerRoleFromStored(undefined, 0)).toBe("lead")
    expect(tripTravelerRoleFromStored("unknown", 1)).toBe("adult")
  })
})
