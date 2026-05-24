import { describe, expect, it } from "vitest"

import {
  insertInvoiceNumberSeriesSchema,
  invoiceFromBookingSchema,
  renderInvoiceInputSchema,
} from "../../src/validation-billing.js"

describe("invoiceFromBookingSchema", () => {
  it("allows callers to omit invoiceNumber when the server should allocate it", () => {
    const result = invoiceFromBookingSchema.parse({
      bookingId: "book_123",
      issueDate: "2026-05-23",
      dueDate: "2026-06-23",
      invoiceType: "proforma",
    })

    expect(result.invoiceNumber).toBeUndefined()
    expect(result.invoiceType).toBe("proforma")
  })

  it("accepts an explicit seriesId for server-side allocation", () => {
    const result = invoiceFromBookingSchema.parse({
      bookingId: "book_123",
      seriesId: "ins_123",
      issueDate: "2026-05-23",
      dueDate: "2026-06-23",
    })

    expect(result.seriesId).toBe("ins_123")
    expect(result.invoiceType).toBe("invoice")
  })

  it("accepts bounded document wait options", () => {
    const result = invoiceFromBookingSchema.parse({
      bookingId: "book_123",
      invoiceNumber: "INV-123",
      issueDate: "2026-05-23",
      dueDate: "2026-06-23",
      wait: true,
      waitTimeoutMs: 10_000,
    })

    expect(result.wait).toBe("pdf")
    expect(result.waitTimeoutMs).toBe(10_000)
  })

  it("accepts currency and line item overrides for externally issued invoices", () => {
    const result = invoiceFromBookingSchema.parse({
      bookingId: "book_123",
      invoiceNumber: "INV-123",
      issueDate: "2026-05-23",
      dueDate: "2026-06-23",
      currency: "ron",
      baseCurrency: "eur",
      fxRateSetId: "fxrs_123",
      subtotalCents: 50_000,
      taxCents: 9_500,
      totalCents: 59_500,
      lineItems: [
        {
          description: "External fiscal invoice line",
          quantity: 1,
          unitAmountCents: 50_000,
          taxRateBps: 1_900,
        },
      ],
    })

    expect(result.currency).toBe("RON")
    expect(result.baseCurrency).toBe("EUR")
    expect(result.lineItems?.[0]?.unitAmountCents).toBe(50_000)
  })
})

describe("renderInvoiceInputSchema", () => {
  it("accepts wait=true as pdf wait mode", () => {
    const result = renderInvoiceInputSchema.parse({ wait: "true" })

    expect(result.format).toBe("pdf")
    expect(result.wait).toBe("pdf")
  })
})

describe("insertInvoiceNumberSeriesSchema", () => {
  it("accepts default and external provider metadata", () => {
    const result = insertInvoiceNumberSeriesSchema.parse({
      code: "smartbill-proforma",
      name: "SmartBill proformas",
      scope: "proforma",
      isDefault: true,
      externalProvider: "smartbill",
      externalConfigKey: "protravel",
    })

    expect(result.isDefault).toBe(true)
    expect(result.externalProvider).toBe("smartbill")
    expect(result.externalConfigKey).toBe("protravel")
  })
})
