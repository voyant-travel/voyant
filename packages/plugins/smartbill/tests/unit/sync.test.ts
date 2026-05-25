import { beforeEach, describe, expect, it, vi } from "vitest"

import { syncSmartbillInvoice, syncSmartbillInvoiceEvent } from "../../src/sync.js"

const financeServiceMock = vi.hoisted(() => ({
  getInvoiceById: vi.fn(),
  listInvoiceExternalRefs: vi.fn(),
  registerInvoiceExternalRef: vi.fn(),
  applyExternalInvoiceAllocation: vi.fn(),
  updateInvoice: vi.fn(),
}))

const buildInvoiceIssuedEventMock = vi.hoisted(() => vi.fn())

vi.mock("@voyantjs/finance", () => ({
  buildInvoiceIssuedEvent: buildInvoiceIssuedEventMock,
  financeService: financeServiceMock,
}))

const basePluginOptions = {
  username: "user@test.com",
  apiToken: "tok",
  companyVatCode: "RO12345678",
  seriesName: "A",
}

function makeClient() {
  return {
    createInvoice: vi.fn().mockResolvedValue({ number: "42", series: "A" }),
    createProforma: vi.fn().mockResolvedValue({ number: "9", series: "P" }),
    cancelInvoice: vi.fn(),
    reverseInvoice: vi.fn(),
    restoreInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
    getPaymentStatus: vi.fn(),
    listTaxes: vi.fn(),
    listSeries: vi.fn(),
    viewInvoicePdf: vi.fn(),
    viewPdf: vi.fn(),
    viewEstimatePdf: vi.fn(),
    listEstimateInvoices: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  financeServiceMock.getInvoiceById.mockResolvedValue({ id: "inv_123", invoiceType: "invoice" })
  financeServiceMock.listInvoiceExternalRefs.mockResolvedValue([])
  financeServiceMock.registerInvoiceExternalRef.mockResolvedValue({ id: "iex_1" })
  financeServiceMock.applyExternalInvoiceAllocation.mockResolvedValue({
    status: "applied",
    invoice: { id: "inv_123" },
  })
  financeServiceMock.updateInvoice.mockResolvedValue({ id: "inv_123" })
  buildInvoiceIssuedEventMock.mockResolvedValue({
    invoiceId: "inv_123",
    invoiceNumber: "INV-1",
    invoiceType: "invoice",
    bookingId: null,
    totalCents: 10000,
    currency: "RON",
    lineItems: [{ description: "Tour", quantity: 1, unitPrice: 100, currency: "RON" }],
  })
})

describe("syncSmartbillInvoice", () => {
  it("loads the finance invoice event and creates a SmartBill invoice", async () => {
    const db = {} as never
    const client = makeClient()

    const result = await syncSmartbillInvoice({
      db,
      invoiceId: "inv_123",
      pluginOptions: basePluginOptions,
      client,
    })

    expect(result.status).toBe("created")
    expect(buildInvoiceIssuedEventMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: "inv_123" }),
      undefined,
    )
    expect(client.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        companyVatCode: "RO12345678",
        seriesName: "A",
        client: expect.objectContaining({ name: "Client" }),
      }),
    )
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      db,
      "inv_123",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "42",
        status: "issued",
      }),
    )
  })

  it("returns unsupported_document_type for credit notes", async () => {
    financeServiceMock.getInvoiceById.mockResolvedValueOnce({
      id: "cred_1",
      invoiceType: "credit_note",
    })

    await expect(
      syncSmartbillInvoice({
        db: {} as never,
        invoiceId: "cred_1",
        pluginOptions: basePluginOptions,
        client: makeClient(),
      }),
    ).resolves.toEqual({
      status: "unsupported_document_type",
      invoiceId: "cred_1",
      invoiceType: "credit_note",
    })
  })
})

describe("syncSmartbillInvoiceEvent", () => {
  it("reuses an existing matching SmartBill ref instead of creating again", async () => {
    const client = makeClient()
    const externalRef = {
      id: "iex_existing",
      invoiceId: "inv_123",
      provider: "smartbill",
      externalId: "42",
      externalNumber: "42",
      externalUrl: null,
      status: "issued",
      syncError: null,
      metadata: {
        companyVatCode: "RO12345678",
        seriesName: "A",
        series: "A",
        number: "42",
        documentType: "invoice",
      },
    }
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([externalRef])

    const result = await syncSmartbillInvoiceEvent({
      event: { id: "inv_123", lineItems: [] },
      documentType: "invoice",
      runtime: {
        client,
        logger: { error: vi.fn(), info: vi.fn() },
        mapEvent: vi.fn().mockResolvedValue({
          companyVatCode: "RO12345678",
          client: { name: "Client" },
          seriesName: "A",
          currency: "RON",
          products: [],
        }),
        eventNames: {
          issued: "invoice.issued",
          proformaIssued: "invoice.proforma.issued",
          voided: "invoice.voided",
          syncRequested: "invoice.external.sync.requested",
        },
        artifacts: { db: {} as never },
        idempotency: { skipExistingExternalRef: true },
        onError: undefined,
        writeBackInvoiceNumber: undefined,
      },
      pluginOptions: basePluginOptions,
    })

    expect(result.status).toBe("existing_ref")
    expect(client.createInvoice).not.toHaveBeenCalled()
  })

  it("reuses an externally seeded SmartBill ref without document metadata", async () => {
    const client = makeClient()
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_123",
        provider: "smartbill",
        externalId: "remote_42",
        externalNumber: "42",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: null,
      },
    ])

    const result = await syncSmartbillInvoiceEvent({
      event: { id: "inv_123", lineItems: [] },
      documentType: "invoice",
      runtime: {
        client,
        logger: { error: vi.fn(), info: vi.fn() },
        mapEvent: vi.fn().mockResolvedValue({
          companyVatCode: "RO12345678",
          client: { name: "Client" },
          seriesName: "A",
          currency: "RON",
          products: [],
        }),
        eventNames: {
          issued: "invoice.issued",
          proformaIssued: "invoice.proforma.issued",
          voided: "invoice.voided",
          syncRequested: "invoice.external.sync.requested",
        },
        artifacts: { db: {} as never },
        idempotency: { skipExistingExternalRef: true },
        onError: undefined,
        writeBackInvoiceNumber: undefined,
      },
      pluginOptions: basePluginOptions,
    })

    expect(result.status).toBe("existing_ref")
    expect(client.createInvoice).not.toHaveBeenCalled()
  })
})
