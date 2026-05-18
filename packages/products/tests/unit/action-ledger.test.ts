import { describe, expect, it } from "vitest"

import { __test__ } from "../../src/action-ledger.js"
import type { Product } from "../../src/schema.js"

const baseProduct: Product = {
  id: "prod_1",
  name: "Croatia Tour",
  status: "draft",
  description: null,
  bookingMode: "date",
  capacityMode: "limited",
  timezone: null,
  visibility: "private",
  activated: false,
  reservationTimeoutMinutes: null,
  sellCurrency: "EUR",
  sellAmountCents: null,
  costAmountCents: null,
  marginPercent: null,
  facilityId: null,
  supplierId: null,
  startDate: null,
  endDate: null,
  pax: null,
  productTypeId: null,
  taxClassId: null,
  customerPaymentPolicy: null,
  tags: [],
  createdAt: new Date("2026-05-15T10:00:00.000Z"),
  updatedAt: new Date("2026-05-15T10:00:00.000Z"),
}

describe("product action ledger helpers", () => {
  it("summarizes only fields that actually changed", () => {
    const changed = __test__.changedProductFields(
      {
        name: "Croatia Deluxe Tour",
        sellAmountCents: 199_00,
        visibility: "private",
      },
      baseProduct,
      {
        ...baseProduct,
        name: "Croatia Deluxe Tour",
        sellAmountCents: 199_00,
        updatedAt: new Date("2026-05-15T10:01:00.000Z"),
      },
    )

    expect(changed).toEqual(["name", "sellAmountCents"])
    expect(__test__.productMutationSummary("update", changed)).toBe(
      "Updated product fields: name, sellAmountCents",
    )
  })

  it("uses input field names for create summaries without copying values", () => {
    const changed = __test__.changedProductFields(
      {
        name: "Croatia Deluxe Tour",
        sellCurrency: "EUR",
        customerPaymentPolicy: {
          deposit: { kind: "percent", percent: 25 },
          minDaysBeforeDepartureForDeposit: 60,
          balanceDueDaysBeforeDeparture: 30,
          balanceDueMinDaysFromNow: 7,
        },
      },
      null,
      baseProduct,
    )

    expect(changed).toEqual(["customerPaymentPolicy", "name", "sellCurrency"])
    expect(__test__.productMutationSummary("create", changed)).toBe(
      "Created product fields: customerPaymentPolicy, name, sellCurrency",
    )
  })

  it("diffs nested mutation fields without counting timestamps", () => {
    const changed = __test__.changedMutationFields(
      {
        name: "Premium cabin",
        sortOrder: 2,
        updatedAt: new Date("2026-05-15T10:02:00.000Z"),
      },
      {
        name: "Standard cabin",
        sortOrder: 2,
        updatedAt: new Date("2026-05-15T10:01:00.000Z"),
      },
      {
        name: "Premium cabin",
        sortOrder: 2,
        updatedAt: new Date("2026-05-15T10:02:00.000Z"),
      },
    )

    expect(changed).toEqual(["name"])
  })

  it("summarizes nested product content mutations", () => {
    expect(__test__.productMutationSummary("update", ["name"], "product option")).toBe(
      "Updated product option fields: name",
    )
    expect(__test__.productMutationSummary("delete", [], "product media")).toBe(
      "Deleted product media",
    )
    expect(__test__.productMutationSummary("duplicate", [], "product itinerary")).toBe(
      "Duplicated product itinerary",
    )
  })

  it("requires both cursor fields and transforms them into an action ledger cursor", () => {
    expect(
      __test__.productActionLedgerQuerySchema.safeParse({
        cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      }).success,
    ).toBe(false)

    const result = __test__.productActionLedgerQuerySchema.safeParse({
      cursorOccurredAt: "2026-05-15T10:02:00.000Z",
      cursorId: "alge_2",
      limit: "25",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      cursor: {
        occurredAt: "2026-05-15T10:02:00.000Z",
        id: "alge_2",
      },
      limit: 25,
    })
  })
})
