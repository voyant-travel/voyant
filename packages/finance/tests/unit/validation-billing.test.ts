import { describe, expect, it } from "vitest"

import {
  insertInvoiceNumberSeriesSchema,
  invoiceFromBookingSchema,
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
