import { describe, expect, it, vi } from "vitest"

import {
  buildSmartbillPaymentBody,
  createSmartbillOwnedSubscriberRuntime,
  createSmartbillSettlementPollers,
  issueSmartbillDocument,
  mapSmartbillPaymentType,
  resolveSmartbillEstimateReference,
  resolveSmartbillPaymentInvoiceRef,
  type SmartbillRuntimeConfig,
} from "../../src/graph-runtime.js"

const config: SmartbillRuntimeConfig = {
  username: "office@example.com",
  apiToken: "token",
  companyVatCode: "RO123",
  seriesName: "INV",
}

describe("package-owned SmartBill runtime", () => {
  it("does not resolve host infrastructure when SmartBill is not configured", () => {
    const resolveDatabase = vi.fn()
    const runtime = createSmartbillOwnedSubscriberRuntime(
      {
        resolveConfig: () => null,
        resolveDatabase,
      },
      {},
    )

    expect(runtime).toBeNull()
    expect(resolveDatabase).not.toHaveBeenCalled()
  })

  it("builds settlement pollers from package config", () => {
    expect(Object.keys(createSmartbillSettlementPollers(config))).toEqual(["smartbill"])
    expect(createSmartbillSettlementPollers(null)).toEqual({})
  })

  it("selects create, proforma, and conversion operations", async () => {
    const client = {
      createInvoice: vi.fn().mockResolvedValue({ number: "1" }),
      createProforma: vi.fn().mockResolvedValue({ number: "2" }),
      convertEstimateToInvoice: vi.fn().mockResolvedValue({ number: "3" }),
    }
    const body = {
      companyVatCode: "RO123",
      client: { name: "Client" },
      seriesName: "INV",
      currency: "RON",
      isTaxIncluded: true,
      products: [],
    }

    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, body, "invoice", null)
    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, body, "proforma", null)
    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, body, "invoice", {
      seriesName: "PRO",
      number: "9",
    })

    expect(client.createInvoice).toHaveBeenCalledOnce()
    expect(client.createProforma).toHaveBeenCalledOnce()
    expect(client.convertEstimateToInvoice).toHaveBeenCalledWith("RO123", "PRO", "9", body)
  })

  it("resolves document references and maps payment events", () => {
    expect(
      resolveSmartbillEstimateReference(
        { provider: "smartbill", externalNumber: "PRO-42", metadata: null },
        "PRO",
      ),
    ).toEqual({ seriesName: "PRO", number: "42" })
    expect(
      resolveSmartbillPaymentInvoiceRef({
        externalId: null,
        externalNumber: "42",
        metadata: { seriesName: "INV" },
      }),
    ).toEqual({ seriesName: "INV", number: "42" })
    expect(mapSmartbillPaymentType("bank_transfer")).toBe("Ordin plata")
    expect(mapSmartbillPaymentType("credit_card")).toBe("Card")

    expect(
      buildSmartbillPaymentBody(
        { companyVatCode: "RO123" },
        {
          invoiceId: "inv_1",
          invoiceNumber: "INV-42",
          invoiceType: "invoice",
          bookingId: "booking_1",
          invoiceCurrency: "RON",
          invoiceTotalCents: 10_000,
          invoicePaidCents: 2_500,
          invoiceBalanceDueCents: 7_500,
          paymentId: "pay_1",
          amountCents: 2_500,
          currency: "RON",
          baseCurrency: null,
          baseAmountCents: null,
          paymentMethod: "bank_transfer",
          status: "completed",
          referenceNumber: "BANK-7",
          paymentDate: "2026-07-11",
        },
        { seriesName: "INV", number: "42" },
      ),
    ).toMatchObject({
      companyVatCode: "RO123",
      currency: "RON",
      value: 25,
      type: "Ordin plata",
      invoicesList: [{ seriesName: "INV", number: "42" }],
    })
  })
})
