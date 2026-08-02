import "./plugin-test-setup.js"
import { describe, expect, it, vi } from "vitest"
import { retrySmartbillInvoiceArtifact } from "../../src/artifacts.js"
import { smartbillPlugin } from "../../src/plugin.js"
import {
  baseOptions,
  bytesResponse,
  eventEnvelope,
  financeServiceMock,
  jsonResponse,
  makeLogger,
  okEnvelope,
  type SmartbillFetch,
  subscriberFor,
  textResponse,
} from "./plugin-test-helpers.js"

describe("smartbillPlugin — invoice PDF artifacts", () => {
  it("re-attaches a SmartBill PDF from an existing external ref", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 smartbill retry")
    const fetchMock = vi.fn<SmartbillFetch>(async () => bytesResponse(200, pdfBytes))
    const upload = vi
      .fn()
      .mockResolvedValue({ key: "invoices/inv_retry/smartbill/invoice-A-1.pdf", url: "" })
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }

    const result = await retrySmartbillInvoiceArtifact({
      runtime: {
        db: {} as never,
        documentStorage: storage,
      },
      client: {
        createInvoice: vi.fn(),
        createProforma: vi.fn(),
        cancelInvoice: vi.fn(),
        reverseInvoice: vi.fn(),
        restoreInvoice: vi.fn(),
        deleteInvoice: vi.fn(),
        getPaymentStatus: vi.fn(),
        listTaxes: vi.fn(),
        listSeries: vi.fn(),
        viewInvoicePdf: async () => ({
          bytes: pdfBytes,
          contentType: "application/pdf",
        }),
        viewPdf: vi.fn(),
        viewEstimatePdf: vi.fn(),
        listEstimateInvoices: vi.fn(),
      },
      externalRef: {
        id: "iex_retry",
        invoiceId: "inv_retry",
        externalId: null,
        externalNumber: "1",
        externalUrl: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "A",
          series: "A",
          number: "1",
        },
      },
      documentType: "invoice",
    })

    expect(result.status).toBe("persisted")
    expect(upload).toHaveBeenCalledWith(
      pdfBytes,
      expect.objectContaining({ contentType: "application/pdf" }),
    )
    expect(financeServiceMock.createInvoiceAttachment).toHaveBeenCalledWith(
      expect.anything(),
      "inv_retry",
      expect.objectContaining({ kind: "smartbill_pdf" }),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not mark retry PDF persistence failed when the ready metadata update fails", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 smartbill retry")
    financeServiceMock.registerInvoiceExternalRef.mockRejectedValueOnce(
      new Error("ref update unavailable"),
    )
    const upload = vi
      .fn()
      .mockResolvedValue({ key: "invoices/inv_retry/smartbill/invoice-A-1.pdf", url: "" })
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }

    await expect(
      retrySmartbillInvoiceArtifact({
        runtime: {
          db: {} as never,
          documentStorage: storage,
        },
        client: {
          createInvoice: vi.fn(),
          createProforma: vi.fn(),
          cancelInvoice: vi.fn(),
          reverseInvoice: vi.fn(),
          restoreInvoice: vi.fn(),
          deleteInvoice: vi.fn(),
          getPaymentStatus: vi.fn(),
          listTaxes: vi.fn(),
          listSeries: vi.fn(),
          viewInvoicePdf: async () => ({
            bytes: pdfBytes,
            contentType: "application/pdf",
          }),
          viewPdf: vi.fn(),
          viewEstimatePdf: vi.fn(),
          listEstimateInvoices: vi.fn(),
        },
        externalRef: {
          id: "iex_retry",
          invoiceId: "inv_retry",
          externalId: null,
          externalNumber: "1",
          externalUrl: null,
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "A",
            series: "A",
            number: "1",
          },
        },
        documentType: "invoice",
      }),
    ).rejects.toThrow("metadata update failed")

    expect(upload).toHaveBeenCalledWith(
      pdfBytes,
      expect.objectContaining({ contentType: "application/pdf" }),
    )
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledTimes(1)
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_retry",
      expect.objectContaining({
        metadata: expect.objectContaining({ pdfPersistStatus: "ready" }),
      }),
    )
    const failedCalls = financeServiceMock.registerInvoiceExternalRef.mock.calls.filter(
      ([, , input]) => input.metadata?.pdfPersistStatus === "failed",
    )
    expect(failedCalls).toHaveLength(0)
  })

  it("registers the SmartBill ref and persists the generated invoice PDF when storage is configured", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 smartbill")
    const fetchMock = vi
      .fn<SmartbillFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }))
      .mockResolvedValueOnce(bytesResponse(200, pdfBytes))
    const upload = vi
      .fn()
      .mockResolvedValue({ key: "invoices/inv_123/smartbill/invoice-A-1.pdf", url: "" })
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      artifacts: {
        db: {} as never,
        documentStorage: storage,
      },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_123",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_123",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "1",
        status: "issued",
      }),
    )
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_123",
      expect.objectContaining({
        metadata: expect.objectContaining({
          pdfPersistStatus: "ready",
          pdfStorageKey: "invoices/inv_123/smartbill/invoice-A-1.pdf",
          pdfPersistError: null,
          pdfPersistStage: null,
        }),
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/invoice/pdf")
    expect(upload).toHaveBeenCalledWith(
      pdfBytes,
      expect.objectContaining({ contentType: "application/pdf" }),
    )
    expect(financeServiceMock.createInvoiceRendition).toHaveBeenCalledWith(
      expect.anything(),
      "inv_123",
      expect.objectContaining({
        format: "pdf",
        status: "ready",
        storageKey: "invoices/inv_123/smartbill/invoice-A-1.pdf",
      }),
    )
    expect(financeServiceMock.createInvoiceAttachment).toHaveBeenCalledWith(
      expect.anything(),
      "inv_123",
      expect.objectContaining({
        kind: "smartbill_pdf",
        name: "SmartBill invoice A-1.pdf",
        storageKey: "invoices/inv_123/smartbill/invoice-A-1.pdf",
      }),
    )
  })

  it("does not record a PDF persistence failure after a successful PDF persist metadata update fails", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 smartbill")
    const fetchMock = vi
      .fn<SmartbillFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }))
      .mockResolvedValueOnce(bytesResponse(200, pdfBytes))
    const upload = vi.fn().mockResolvedValue({
      key: "invoices/inv_ready_update_fail/smartbill/invoice-A-1.pdf",
      url: "",
    })
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }
    const logger = makeLogger()
    financeServiceMock.registerInvoiceExternalRef
      .mockResolvedValueOnce({ id: "iex_1" })
      .mockRejectedValueOnce(new Error("ref update unavailable"))
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      artifacts: {
        db: {} as never,
        documentStorage: storage,
      },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_ready_update_fail",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(financeServiceMock.createInvoiceRendition).toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceAttachment).toHaveBeenCalled()
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledTimes(2)
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "inv_ready_update_fail",
      expect.objectContaining({
        metadata: expect.objectContaining({ pdfPersistStatus: "ready" }),
      }),
    )
    const failedCalls = financeServiceMock.registerInvoiceExternalRef.mock.calls.filter(
      ([, , input]) => input.metadata?.pdfPersistStatus === "failed",
    )
    expect(failedCalls).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledWith(
      "[smartbill] artifact persistence metadata update failed for inv_ready_update_fail",
      expect.any(Error),
    )
  })

  it("records PDF persistence failures on the SmartBill external ref", async () => {
    const fetchMock = vi
      .fn<SmartbillFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }))
      .mockResolvedValue(textResponse(503, "pdf unavailable"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      // Keep the retried PDF 503s fast in tests.
      resilience: { retry: { baseDelayMs: 0, maxDelayMs: 1 } },
      artifacts: {
        db: {} as never,
        documentStorage: {
          name: "test-storage",
          upload: vi.fn(),
          delete: vi.fn(),
          signedUrl: vi.fn(),
          get: vi.fn(),
        },
      },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_pdf_fail",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    // 1 createInvoice POST (no retry) + 3 PDF GET attempts (503 is retried).
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_pdf_fail",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "1",
        status: "issued",
        metadata: expect.objectContaining({
          pdfPersistStatus: "failed",
          pdfPersistStage: "viewInvoicePdf",
          pdfPersistError: expect.stringContaining("503"),
          pdfPersistedAt: null,
        }),
      }),
    )
    expect(financeServiceMock.createInvoiceRendition).not.toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceAttachment).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      "[smartbill] artifact persistence failed for inv_pdf_fail",
      expect.any(Error),
    )
  })

  it("does not upload again when a SmartBill PDF attachment already exists", async () => {
    financeServiceMock.listInvoiceAttachments.mockResolvedValueOnce([
      { id: "inva_existing", kind: "smartbill_pdf" },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const upload = vi.fn()
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger: makeLogger(),
      artifacts: {
        db: {} as never,
        documentStorage: storage,
      },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_123",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(upload).not.toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceRendition).not.toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceAttachment).not.toHaveBeenCalled()
  })

  it("does not upload a PDF when the finance invoice is missing", async () => {
    financeServiceMock.registerInvoiceExternalRef.mockResolvedValueOnce(null)
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const upload = vi.fn()
    const storage = {
      name: "test-storage",
      upload,
      delete: vi.fn(),
      signedUrl: vi.fn(),
      get: vi.fn(),
    }
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger: makeLogger(),
      artifacts: {
        db: {} as never,
        documentStorage: storage,
      },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_missing",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(upload).not.toHaveBeenCalled()
    expect(financeServiceMock.listInvoiceAttachments).not.toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceRendition).not.toHaveBeenCalled()
    expect(financeServiceMock.createInvoiceAttachment).not.toHaveBeenCalled()
  })
})
