import { describe, expect, it } from "vitest"

import {
  getSmartbillInvoiceDocumentLinks,
  resolveSmartbillInvoiceReferenceParts,
  type SmartbillInvoiceExternalRef,
  selectSmartbillInvoiceRef,
} from "../../src/invoice-ui-data.js"

const baseRef: SmartbillInvoiceExternalRef = {
  id: "invext_1",
  invoiceId: "inv_1",
  provider: "smartbill",
  externalId: "42",
  externalNumber: "42",
  externalUrl: "https://smartbill.example.test/invoice/42",
  status: "issued",
  metadata: {
    companyVatCode: "RO123",
    seriesName: "SB",
    number: "42",
    documentType: "invoice",
    pdfUrl: "https://smartbill.example.test/invoice/42.pdf",
  },
  syncedAt: "2026-05-22T04:00:00.000Z",
  syncError: null,
  createdAt: "2026-05-22T04:00:00.000Z",
  updatedAt: "2026-05-22T04:00:00.000Z",
}

describe("SmartBill invoice UI data helpers", () => {
  it("selects the SmartBill ref from mixed provider refs", () => {
    expect(
      selectSmartbillInvoiceRef([{ ...baseRef, id: "stripe_1", provider: "stripe" }, baseRef]),
    ).toBe(baseRef)
  })

  it("resolves display reference parts from metadata with external id fallbacks", () => {
    expect(resolveSmartbillInvoiceReferenceParts(baseRef)).toEqual({
      companyVatCode: "RO123",
      seriesName: "SB",
      number: "42",
      documentType: "invoice",
    })

    expect(
      resolveSmartbillInvoiceReferenceParts({
        ...baseRef,
        externalId: "99",
        externalNumber: null,
        metadata: null,
      }).number,
    ).toBe("99")
  })

  it("deduplicates document links from external url and metadata", () => {
    expect(getSmartbillInvoiceDocumentLinks(baseRef)).toEqual([
      {
        label: "SmartBill document",
        href: "https://smartbill.example.test/invoice/42",
      },
      {
        label: "SmartBill PDF",
        href: "https://smartbill.example.test/invoice/42.pdf",
      },
    ])

    expect(
      getSmartbillInvoiceDocumentLinks({
        ...baseRef,
        metadata: { pdfUrl: baseRef.externalUrl },
      }),
    ).toHaveLength(1)
  })
})
