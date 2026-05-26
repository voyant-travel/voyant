import { describe, expect, it } from "vitest"

import { buildFinanceRouteRuntime } from "../../src/route-runtime.js"

describe("buildFinanceRouteRuntime", () => {
  it("exposes invoice line description resolver options", async () => {
    const descriptionResolver = () => "Custom legal line"
    const runtime = buildFinanceRouteRuntime({}, { descriptionResolver })

    expect(
      runtime.descriptionResolver?.({
        booking: {
          id: "book_123",
          bookingNumber: "BK-123",
          personId: null,
          organizationId: null,
          sellCurrency: "RON",
          baseCurrency: null,
          fxRateSetId: null,
          sellAmountCents: 12_000,
          baseSellAmountCents: null,
        },
        line: {
          bookingItemId: null,
          bookingPaymentScheduleId: null,
          description: "Fallback line",
          quantity: 1,
          unitPriceCents: 12_000,
          totalCents: 12_000,
          taxAmountCents: 0,
          taxRate: null,
          sortOrder: 0,
        },
      }),
    ).toBe("Custom legal line")
  })
})
