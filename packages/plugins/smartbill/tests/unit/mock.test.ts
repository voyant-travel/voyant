import { describe, expect, it } from "vitest"

import { createSmartbillClient } from "../../src/client.js"
import { createSmartbillMockServer } from "../../src/mock.js"

const baseOptions = {
  username: "user@example.com",
  apiToken: "test-token",
  companyVatCode: "RO123",
}

const invoiceBody = {
  companyVatCode: baseOptions.companyVatCode,
  client: { name: "Acme" },
  seriesName: "SB",
  currency: "RON",
  products: [
    {
      name: "Tour",
      measureUnit: "buc",
      quantity: 2,
      price: 100,
      currency: "RON",
      isTaxIncluded: true,
    },
  ],
}

describe("createSmartbillMockServer", () => {
  it("acts as a SmartBill-shaped fetch target for client tests", async () => {
    const mock = createSmartbillMockServer()
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "http://smartbill.local/SBORO/api",
      fetch: mock.fetch,
    })

    const created = await client.createInvoice({
      ...invoiceBody,
      payment: { type: "Card", value: 200, isCash: false },
    })
    expect(created).toMatchObject({
      status: "Ok",
      series: "SB",
      number: "1",
      url: "smartbill-mock://test-document/invoice/RO123/SB/1.pdf",
    })

    const pdf = await client.viewInvoicePdf("RO123", "SB", "1")
    expect(pdf.contentType).toBe("application/pdf")
    // PDFs start with the magic %PDF- header.
    expect(new TextDecoder().decode(pdf.bytes.slice(0, 5))).toBe("%PDF-")

    const status = await client.getPaymentStatus("RO123", "SB", "1")
    expect(status).toMatchObject({
      status: "Ok",
      paid: true,
      invoiceTotalAmount: 200,
      paidAmount: 200,
      unpaidAmount: 0,
    })
    expect(status.payments).toHaveLength(1)
    expect(status.payments?.[0]).toMatchObject({ type: "Card", value: 200 })

    const cancelled = await client.cancelInvoice("RO123", "SB", "1")
    expect(cancelled.status).toBe("Ok")
    expect(mock.getDocument("invoice", "RO123", "SB", "1")?.status).toBe("cancelled")
  })

  it("returns the live envelope shape for /tax", async () => {
    const mock = createSmartbillMockServer()
    const response = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/SBORO/api/tax",
    })
    expect(response.headers["content-type"]).toMatch(/application\/json/)
    const body = JSON.parse(response.body as string)
    expect(body.status).toBe("Ok")
    expect(body.taxes).toEqual(
      expect.arrayContaining([
        { name: "Normala", percentage: 19 },
        { name: "Redusa", percentage: 9 },
      ]),
    )
  })

  it("returns the live envelope shape for /series with single-letter type codes", async () => {
    const mock = createSmartbillMockServer()
    const response = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/SBORO/api/series",
    })
    const body = JSON.parse(response.body as string)
    expect(body.status).toBe("Ok")
    expect(body.list).toEqual(
      expect.arrayContaining([
        { name: "SB-TEST", nextNumber: 1, type: "f" },
        { name: "PF-TEST", nextNumber: 1, type: "p" },
      ]),
    )
  })

  it("returns PDF bytes with application/pdf and a debug URL header", async () => {
    const mock = createSmartbillMockServer()
    await mock.handleRequest({
      method: "POST",
      url: "http://smartbill.local/SBORO/api/invoice",
      body: JSON.stringify(invoiceBody),
    })

    const pdf = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/SBORO/api/invoice/pdf?cif=RO123&seriesname=SB&number=1",
    })
    expect(pdf.headers["content-type"]).toBe("application/pdf")
    expect(pdf.headers["x-mock-pdf-url"]).toContain("test-document/invoice/RO123/SB/1.pdf")
    expect(pdf.body).toBeInstanceOf(Uint8Array)
    const bytes = pdf.body as Uint8Array
    // %PDF- header and %%EOF trailer mark a well-formed file.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
    expect(new TextDecoder().decode(bytes.slice(-6)).trim()).toBe("%%EOF")
  })

  it("tracks proforma conversion via /estimate/invoices with areInvoicesCreated", async () => {
    const mock = createSmartbillMockServer()
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "http://smartbill.local",
      fetch: mock.fetch,
    })

    const estimate = await client.createProforma({ ...invoiceBody, seriesName: "PF" })
    const before = await client.listEstimateInvoices("RO123", "PF", estimate.number ?? "")
    expect(before.areInvoicesCreated).toBe(false)
    expect(before.invoices).toEqual([])

    const invoice = await client.convertEstimateToInvoice("RO123", "PF", estimate.number ?? "", {
      ...invoiceBody,
      seriesName: "SB",
    })

    const after = await client.listEstimateInvoices("RO123", "PF", estimate.number ?? "")
    expect(after.areInvoicesCreated).toBe(true)
    expect(after.invoices?.[0]).toMatchObject({
      series: invoice.series,
      number: invoice.number,
    })
    expect(after.series).toBe(invoice.series)
    expect(after.number).toBe(invoice.number)
  })

  it("includes VAT in payment status totals for tax-exclusive products", async () => {
    const mock = createSmartbillMockServer()
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "http://smartbill.local",
      fetch: mock.fetch,
    })

    await client.createInvoice({
      ...invoiceBody,
      products: [
        {
          name: "Consulting",
          measureUnit: "buc",
          quantity: 1,
          price: 100,
          currency: "RON",
          isTaxIncluded: false,
          taxPercentage: 19,
        },
      ],
      payment: { type: "Card", value: 100, isCash: false },
    })

    const status = await client.getPaymentStatus("RO123", "SB", "1")
    expect(status).toMatchObject({
      paid: false,
      invoiceTotalAmount: 119,
      paidAmount: 100,
      unpaidAmount: 19,
    })
  })

  it("uses the default mock tax for tax-exclusive products without line tax", async () => {
    const mock = createSmartbillMockServer({
      taxes: [{ name: "Standard", percentage: 21, default: true }],
    })
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "http://smartbill.local",
      fetch: mock.fetch,
    })

    await client.createInvoice({
      ...invoiceBody,
      products: [
        {
          name: "Consulting",
          measureUnit: "buc",
          quantity: 1,
          price: 100,
          currency: "RON",
          isTaxIncluded: false,
        },
      ],
      payment: { type: "Card", value: 100, isCash: false },
    })

    const status = await client.getPaymentStatus("RO123", "SB", "1")
    expect(status).toMatchObject({
      paid: false,
      invoiceTotalAmount: 121,
      paidAmount: 100,
      unpaidAmount: 21,
    })
  })

  it("returns an error envelope when an invoice is not found", async () => {
    const mock = createSmartbillMockServer()
    const response = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/SBORO/api/invoice/paymentstatus?cif=RO123&seriesname=SB&number=999",
    })
    expect(response.status).toBe(404)
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: "Error",
      errorText: expect.stringContaining("not found"),
    })
  })

  it("handles full apiUrl-shaped request URLs", async () => {
    const mock = createSmartbillMockServer()
    const response = await mock.handleRequest({
      method: "POST",
      url: "http://127.0.0.1:4555/SBORO/api/invoice",
      body: JSON.stringify(invoiceBody),
    })

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: "Ok",
      series: "SB",
      number: "1",
    })
    expect(mock.getDocument("invoice", "RO123", "SB", "1")?.body.mentions).toContain(
      "TEST DOCUMENT",
    )
  })
})
