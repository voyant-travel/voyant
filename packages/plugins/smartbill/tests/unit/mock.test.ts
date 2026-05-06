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
    expect(created).toEqual({
      series: "SB",
      number: "1",
      url: "smartbill-mock://test-document/invoice/RO123/SB/1.pdf",
    })

    const pdf = await client.viewPdf("RO123", "SB", "1")
    expect(pdf.url).toContain("test-document/invoice/RO123/SB/1.pdf")

    const status = await client.getPaymentStatus("RO123", "SB", "1")
    expect(status).toEqual({ status: "paid", paidAmount: 200, unpaidAmount: 0 })

    await client.cancelInvoice("RO123", "SB", "1")
    expect(mock.getDocument("invoice", "RO123", "SB", "1")?.status).toBe("cancelled")
  })

  it("tracks proforma conversion for /estimate/invoices polling", async () => {
    const mock = createSmartbillMockServer()
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "http://smartbill.local",
      fetch: mock.fetch,
    })

    const estimate = await client.createProforma({ ...invoiceBody, seriesName: "PF" })
    const before = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/estimate/invoices?cif=RO123&seriesname=PF&number=1",
    })
    expect(JSON.parse(before.body)).toEqual({ invoices: [] })

    const invoice = mock.convertEstimateToInvoice({
      companyVatCode: "RO123",
      seriesName: "PF",
      number: estimate.number ?? "",
      invoiceSeriesName: "SB",
    })

    const after = await mock.handleRequest({
      method: "GET",
      url: "http://smartbill.local/estimate/invoices?cif=RO123&seriesname=PF&number=1",
    })
    expect(JSON.parse(after.body)).toEqual({ invoices: [invoice] })
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

    await expect(client.getPaymentStatus("RO123", "SB", "1")).resolves.toEqual({
      status: "partially_paid",
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

    await expect(client.getPaymentStatus("RO123", "SB", "1")).resolves.toEqual({
      status: "partially_paid",
      paidAmount: 100,
      unpaidAmount: 21,
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
    expect(JSON.parse(response.body)).toMatchObject({ series: "SB", number: "1" })
    expect(mock.getDocument("invoice", "RO123", "SB", "1")?.body.mentions).toContain(
      "TEST DOCUMENT",
    )
  })
})
