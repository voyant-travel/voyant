import { describe, expect, it } from "vitest"

import { buildFinanceRouteRuntime } from "../../src/route-runtime.js"

describe("buildFinanceRouteRuntime", () => {
  it("exposes invoice-from-booking resolver options", async () => {
    const descriptionResolver = () => "Custom legal line"
    const invoiceDueDateResolver = () => "2026-05-23"
    const runtime = buildFinanceRouteRuntime(
      {},
      {
        descriptionResolver,
        invoiceDueDateResolver,
        paymentScheduleLineDescriptionFormat: "product_only",
      },
    )

    expect(runtime.paymentScheduleLineDescriptionFormat).toBe("product_only")
    expect(
      runtime.invoiceDueDateResolver?.({
        issueDate: "2026-05-23",
        dueDate: "2026-05-01",
        invoiceType: "invoice",
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
        bookingPaymentSchedule: {
          id: "bps_123",
          bookingId: "book_123",
          bookingItemId: null,
          scheduleType: "balance",
          dueDate: "2026-05-01",
          currency: "RON",
          amountCents: 12_000,
        },
      }),
    ).toBe("2026-05-23")
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
