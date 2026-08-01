import { describe, expect, it } from "vitest"

import { normalizeProductSelection } from "./sessions-production.js"

const PRODUCT_TARGET = { kind: "product", productId: "prod_selection" } as const

describe("normalizeProductSelection", () => {
  it("projects product selections to the server-owned booking session shape", () => {
    const normalized = normalizeProductSelection(PRODUCT_TARGET, {
      configure: {
        pax: { adult: 2, child: 0, infant: "1" },
        departureSlotId: "  slot_1  ",
        departureDate: "2026-08-01",
        departureTime: "09:30",
        variantId: "variant_a",
        optionSelections: [
          { optionId: "opt_1", optionUnitId: "unit_1", quantity: 2, ignored: "x" },
          { optionId: "opt_2", quantity: 0 },
          "invalid",
        ],
      },
      billing: {
        buyerType: "B2C",
        contact: {
          firstName: " Ada ",
          lastName: " Lovelace ",
          email: "ada@example.test",
          phone: " +400000000 ",
          ignored: "client-only",
        },
        address: { country: " RO ", street: "not accepted yet" },
      },
      travelers: [
        { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", rowId: "trav_1" },
        { loyaltyNumber: "client-owned" },
      ],
      accommodation: { travelerAssignments: { room_1: "trav_1", empty: "" }, nightlyRate: 100 },
      addons: [{ extraId: "extra_1", quantity: 1, cost: 123 }],
      arbitrary: { nested: true },
    })

    expect(normalized).toEqual({
      configure: {
        pax: { adult: 2 },
        departureSlotId: "slot_1",
        departureDate: "2026-08-01",
        departureTime: "09:30",
        variantId: "variant_a",
        optionSelections: [{ optionId: "opt_1", optionUnitId: "unit_1", quantity: 2 }],
      },
      billing: {
        buyerType: "B2C",
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          phone: "+400000000",
        },
        address: { country: "RO" },
      },
      travelers: [
        { rowId: "trav_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
      ],
      accommodation: { travelerAssignments: { room_1: "trav_1" } },
      addons: [{ extraId: "extra_1", quantity: 1 }],
    })
  })

  it.each([
    ["entity", { entity: "products" }],
    ["source", { configure: { source: "supplier" } }],
    ["status", { travelers: [{ firstName: "Ada", status: "confirmed" }] }],
    ["price override", { configure: { priceOverride: { total: 1 } } }],
    ["supplier result", { supplierResult: { reference: "abc" } }],
    ["operator-only field", { billing: { operatorOnly: true } }],
    ["passport plaintext", { travelers: [{ firstName: "Ada", passportNumber: "123" }] }],
    ["document class plaintext", { travelers: [{ firstName: "Ada", document_class: "P" }] }],
  ])("rejects %s", (_label, selection) => {
    expect(() => normalizeProductSelection(PRODUCT_TARGET, selection)).toThrow(
      /booking_session_selection_forbidden_field/,
    )
  })
})
