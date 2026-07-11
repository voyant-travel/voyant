import { createContainer, createEventBus } from "@voyant-travel/core"
import { financeService } from "@voyant-travel/finance"
import type { SmartbillInvoiceBody } from "@voyant-travel/plugin-smartbill"
import { SMARTBILL_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/plugin-smartbill/subscriber-runtime"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildSmartbillPaymentBody,
  issueSmartbillDocument,
  mapSmartbillPaymentType,
  registerOperatorSmartbillSubscriberRuntimeService,
  resolveConvertedSmartbillEstimateRef,
  resolveSmartbillEstimateReference,
  resolveSmartbillPaymentInvoiceRef,
  syncRecordedInvoicePaymentWithDb,
} from "./smartbill-subscriber-runtime"

type InvoicePaymentRecordedEvent = Parameters<typeof syncRecordedInvoicePaymentWithDb>[2]

const payload: InvoicePaymentRecordedEvent = {
  invoiceId: "inv_1",
  invoiceNumber: "SB-42",
  invoiceType: "invoice",
  bookingId: "book_1",
  invoiceCurrency: "RON",
  invoiceTotalCents: 12500,
  invoicePaidCents: 12500,
  invoiceBalanceDueCents: 0,
  paymentId: "pay_1",
  amountCents: 12500,
  currency: "RON",
  baseCurrency: null,
  baseAmountCents: null,
  paymentMethod: "bank_transfer",
  status: "completed",
  referenceNumber: "BT-99",
  paymentDate: "2026-06-30",
}

const runtime = {
  username: "user@example.test",
  apiToken: "token",
  companyVatCode: "RO12345678",
  invoiceSeriesName: "SB",
  proformaSeriesName: "PF",
  apiUrl: "https://smartbill.test/api",
  language: "RO",
  art311SpecialRegime: false,
  client: {},
}

const invoiceBody: SmartbillInvoiceBody = {
  companyVatCode: "RO123",
  client: { name: "Client" },
  seriesName: "SB-TEST",
  currency: "RON",
  products: [
    {
      name: "Travel package",
      measuringUnitName: "buc",
      quantity: 1,
      price: 100,
      currency: "RON",
      isTaxIncluded: true,
    },
  ],
}

function smartbillClient() {
  return {
    createInvoice: vi.fn().mockResolvedValue({ series: "SB-TEST", number: "1" }),
    createProforma: vi.fn().mockResolvedValue({ series: "PF-TEST", number: "1" }),
    convertEstimateToInvoice: vi.fn().mockResolvedValue({ series: "SB-TEST", number: "1" }),
  }
}

describe("SmartBill package subscriber adapter", () => {
  it("registers the Operator service consumed by package-owned descriptors", async () => {
    const container = createContainer()
    const eventBus = createEventBus()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await registerOperatorSmartbillSubscriberRuntimeService({ bindings: {}, container, eventBus })

    expect(container.has(SMARTBILL_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe("SmartBill payment sync", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("builds SmartBill collection bodies from completed invoice payments", () => {
    expect(mapSmartbillPaymentType("bank_transfer")).toBe("Ordin plata")
    expect(mapSmartbillPaymentType("credit_card")).toBe("Card")
    expect(mapSmartbillPaymentType("cheque")).toBe("CEC")
    expect(mapSmartbillPaymentType("other")).toBe("Alta incasare")

    expect(
      resolveSmartbillPaymentInvoiceRef({
        externalId: null,
        externalNumber: "42",
        metadata: { seriesName: "SB", number: "42" },
      }),
    ).toEqual({ seriesName: "SB", number: "42" })

    expect(buildSmartbillPaymentBody(runtime, payload, { seriesName: "SB", number: "42" })).toEqual(
      {
        companyVatCode: "RO12345678",
        issueDate: "2026-06-30",
        currency: "RON",
        value: 125,
        type: "Ordin plata",
        isCash: false,
        observation: "Voyant payment pay_1 (BT-99)",
        useInvoiceDetails: true,
        invoicesList: [{ seriesName: "SB", number: "42" }],
      },
    )
  })

  it("pushes completed local invoice payments to SmartBill and marks the ref paid", async () => {
    const listRefs = vi.spyOn(financeService, "listInvoiceExternalRefs").mockResolvedValue([
      {
        id: "iner_1",
        invoiceId: payload.invoiceId,
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.test/invoice/42",
        status: "issued",
        metadata: { seriesName: "SB", number: "42", documentType: "invoice" },
        syncedAt: null,
        syncError: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      },
    ])
    const registerRef = vi
      .spyOn(financeService, "registerInvoiceExternalRef")
      .mockResolvedValue(null)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "ok", number: "RCPT-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await syncRecordedInvoicePaymentWithDb({} as never, runtime as never, payload)

    expect(listRefs).toHaveBeenCalledWith({}, payload.invoiceId)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://smartbill.test/api/payment",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          companyVatCode: "RO12345678",
          issueDate: "2026-06-30",
          currency: "RON",
          value: 125,
          type: "Ordin plata",
          isCash: false,
          observation: "Voyant payment pay_1 (BT-99)",
          useInvoiceDetails: true,
          invoicesList: [{ seriesName: "SB", number: "42" }],
        }),
      }),
    )
    expect(registerRef).toHaveBeenCalledWith(
      {},
      payload.invoiceId,
      expect.objectContaining({
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.test/invoice/42",
        status: "paid",
        syncError: null,
        metadata: expect.objectContaining({
          documentType: "invoice",
          lastPaymentSync: expect.objectContaining({
            paymentId: "pay_1",
            smartbillValue: 125,
            smartbillCurrency: "RON",
            type: "Ordin plata",
          }),
        }),
      }),
    )
  })

  it("does not post duplicate SmartBill payments for a redelivered payment event", async () => {
    vi.spyOn(financeService, "listInvoiceExternalRefs").mockResolvedValue([
      {
        id: "iner_1",
        invoiceId: payload.invoiceId,
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.test/invoice/42",
        status: "paid",
        metadata: {
          seriesName: "SB",
          number: "42",
          documentType: "invoice",
          lastPaymentSync: { paymentId: payload.paymentId },
        },
        syncedAt: null,
        syncError: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      },
    ])
    const registerRef = vi.spyOn(financeService, "registerInvoiceExternalRef")
    const fetchMock = vi.spyOn(globalThis, "fetch")

    await syncRecordedInvoicePaymentWithDb({} as never, runtime as never, payload)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(registerRef).not.toHaveBeenCalled()
  })

  it("stores SmartBill payment failures in metadata without blocking later payments", async () => {
    vi.spyOn(financeService, "listInvoiceExternalRefs").mockResolvedValue([
      {
        id: "iner_1",
        invoiceId: payload.invoiceId,
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.test/invoice/42",
        status: "issued",
        metadata: { seriesName: "SB", number: "42", documentType: "invoice" },
        syncedAt: null,
        syncError: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      },
    ])
    const registerRef = vi
      .spyOn(financeService, "registerInvoiceExternalRef")
      .mockResolvedValue(null)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errorText: "temporary SmartBill outage" }), { status: 503 }),
    )

    await syncRecordedInvoicePaymentWithDb({} as never, runtime as never, payload)

    expect(registerRef).toHaveBeenCalledWith(
      {},
      payload.invoiceId,
      expect.objectContaining({
        provider: "smartbill",
        status: "issued",
        syncError: null,
        metadata: expect.objectContaining({
          lastPaymentSyncError: expect.objectContaining({
            paymentId: payload.paymentId,
            message: "temporary SmartBill outage",
          }),
        }),
      }),
    )
  })

  it("skips SmartBill payment pushes for non-invoice or non-completed events", async () => {
    const listRefs = vi.spyOn(financeService, "listInvoiceExternalRefs")
    const fetchMock = vi.spyOn(globalThis, "fetch")

    await syncRecordedInvoicePaymentWithDb({} as never, runtime as never, {
      ...payload,
      status: "pending",
    })
    await syncRecordedInvoicePaymentWithDb({} as never, runtime as never, {
      ...payload,
      invoiceType: "proforma",
    })

    expect(listRefs).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("SmartBill proforma conversion sync", () => {
  it("converts a final invoice from the source SmartBill estimate", async () => {
    const client = smartbillClient()

    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, invoiceBody, "invoice", {
      seriesName: "PF-TEST",
      number: "1",
    })

    expect(client.convertEstimateToInvoice).toHaveBeenCalledWith(
      "RO123",
      "PF-TEST",
      "1",
      invoiceBody,
    )
    expect(client.createInvoice).not.toHaveBeenCalled()
    expect(client.createProforma).not.toHaveBeenCalled()
  })

  it("keeps standalone final invoices on the create invoice path", async () => {
    const client = smartbillClient()

    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, invoiceBody, "invoice", null)

    expect(client.createInvoice).toHaveBeenCalledWith(invoiceBody)
    expect(client.convertEstimateToInvoice).not.toHaveBeenCalled()
  })

  it("keeps proformas on the estimate creation path", async () => {
    const client = smartbillClient()

    await issueSmartbillDocument({ client, companyVatCode: "RO123" }, invoiceBody, "proforma", {
      seriesName: "PF-TEST",
      number: "1",
    })

    expect(client.createProforma).toHaveBeenCalledWith(invoiceBody)
    expect(client.createInvoice).not.toHaveBeenCalled()
    expect(client.convertEstimateToInvoice).not.toHaveBeenCalled()
  })

  it("resolves SmartBill estimate references from prefixed external numbers", () => {
    expect(
      resolveSmartbillEstimateReference(
        {
          provider: "smartbill",
          externalNumber: "PF-TEST-1",
          metadata: { documentType: "proforma" },
        },
        "PF-TEST",
      ),
    ).toEqual({ seriesName: "PF-TEST", number: "1" })
  })

  it("prefers SmartBill metadata for estimate references", () => {
    expect(
      resolveSmartbillEstimateReference(
        {
          provider: "smartbill",
          externalNumber: "ignored",
          metadata: { series: "PF-TEST", seriesName: "REQUESTED-PF", number: "42" },
        },
        "OTHER",
      ),
    ).toEqual({ seriesName: "PF-TEST", number: "42" })
  })

  it("uses emitted conversion context before reading the invoice row", async () => {
    const listRefs = vi.spyOn(financeService, "listInvoiceExternalRefs").mockResolvedValue([
      {
        id: "iner_pf_1",
        invoiceId: "proforma_1",
        provider: "smartbill",
        externalId: "1",
        externalNumber: "PF-TEST-1",
        externalUrl: null,
        status: "issued",
        metadata: { series: "PF-TEST", number: "1", documentType: "proforma" },
        syncedAt: null,
        syncError: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        updatedAt: new Date("2026-06-01T00:00:00Z"),
      },
    ])
    const db = {
      select: vi.fn(() => {
        throw new Error("invoice row should not be read when event carries conversion context")
      }),
    }

    await expect(
      resolveConvertedSmartbillEstimateRef(
        db as never,
        { proformaSeriesName: "PF-TEST" },
        "invoice_1",
        "proforma_1",
      ),
    ).resolves.toEqual({ seriesName: "PF-TEST", number: "1" })
    expect(listRefs).toHaveBeenCalledWith(db, "proforma_1")
  })

  it("rejects refs without a SmartBill estimate number", () => {
    expect(
      resolveSmartbillEstimateReference(
        {
          provider: "smartbill",
          metadata: { series: "PF-TEST" },
        },
        "PF-TEST",
      ),
    ).toBeNull()
  })
})
