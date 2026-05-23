import type { Plugin } from "@voyantjs/core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { retrySmartbillInvoiceArtifact } from "../../src/artifacts.js"
import { smartbillPlugin } from "../../src/plugin.js"
import type { SmartbillFetch } from "../../src/types.js"

const financeServiceMock = vi.hoisted(() => ({
  listInvoiceExternalRefs: vi.fn(),
  registerInvoiceExternalRef: vi.fn(),
  applyExternalInvoiceAllocation: vi.fn(),
  listInvoiceAttachments: vi.fn(),
  createInvoiceRendition: vi.fn(),
  createInvoiceAttachment: vi.fn(),
}))

vi.mock("@voyantjs/finance", () => ({
  financeService: financeServiceMock,
}))

function eventEnvelope<T>(data: T) {
  return {
    name: "test.event",
    data,
    emittedAt: "2026-01-01T00:00:00.000Z",
  }
}

function makeResponse(status: number, text: string, isJson: boolean) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (!isJson) throw new Error("not json")
      return JSON.parse(text)
    },
    text: async () => text,
    arrayBuffer: async () => {
      const bytes = new TextEncoder().encode(text)
      const copy = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(copy).set(bytes)
      return copy
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? isJson
            ? "application/json; charset=utf-8"
            : "text/plain"
          : null,
    },
  }
}

function jsonResponse(status: number, body: unknown) {
  return makeResponse(status, JSON.stringify(body), true)
}

function textResponse(status: number, text: string) {
  return makeResponse(status, text, false)
}

function bytesResponse(status: number, bytes: Uint8Array, contentType = "application/pdf") {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("not json")
    },
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => bytes.buffer.slice(0),
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
  }
}

const okEnvelope = { status: "Ok", message: "", errorText: "" }

const baseOptions = {
  username: "user@test.com",
  apiToken: "tok",
  companyVatCode: "RO12345678",
  seriesName: "A",
}

function makeLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
  }
}

function subscriberFor(plugin: Plugin, event: string) {
  const subscriber = plugin.subscribers?.find((candidate) => candidate.event === event)
  if (!subscriber) throw new Error(`Missing SmartBill subscriber for ${event}`)
  return subscriber
}

beforeEach(() => {
  vi.clearAllMocks()
  financeServiceMock.listInvoiceExternalRefs.mockResolvedValue([])
  financeServiceMock.registerInvoiceExternalRef.mockResolvedValue({ id: "iex_1" })
  financeServiceMock.applyExternalInvoiceAllocation.mockResolvedValue({
    status: "applied",
    invoice: { id: "inv_123" },
  })
  financeServiceMock.listInvoiceAttachments.mockResolvedValue([])
  financeServiceMock.createInvoiceRendition.mockResolvedValue({ id: "invr_1" })
  financeServiceMock.createInvoiceAttachment.mockResolvedValue({
    id: "inva_1",
    storageKey: "invoices/inv_123/smartbill/invoice-A-1.pdf",
  })
})

describe("smartbillPlugin structure", () => {
  it("returns a Plugin with name and version", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    expect(plugin.name).toBe("smartbill")
    expect(plugin.version).toBe("0.1.0")
    expect(plugin.subscribers).toHaveLength(4)
  })

  it("subscribes to default event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    const events = plugin.subscribers!.map((s) => s.event)
    expect(events).toEqual([
      "invoice.issued",
      "invoice.proforma.issued",
      "invoice.voided",
      "invoice.external.sync.requested",
    ])
  })

  it("subscribes to custom event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      events: {
        issued: "custom.issued",
        voided: "custom.voided",
        syncRequested: "custom.sync",
      },
    })
    const events = plugin.subscribers!.map((s) => s.event)
    expect(events).toEqual([
      "custom.issued",
      "invoice.proforma.issued",
      "custom.voided",
      "custom.sync",
    ])
  })

  it("fails fast on invalid plugin options", () => {
    expect(() =>
      smartbillPlugin({
        ...baseOptions,
        username: "",
      }),
    ).toThrowError(/Invalid SmartBill plugin options/)
  })
})

describe("smartbillPlugin — invoice.issued subscriber", () => {
  it("calls createInvoice with mapped body", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
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
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body ?? "{}")
    expect(body.companyVatCode).toBe("RO12345678")
    expect(body.seriesName).toBe("A")
    expect(body.client.name).toBe("Test SRL")
    expect(logger.info).toHaveBeenCalledOnce()
  })

  it("logs error and does not throw on failure", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "boom"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    // Should not throw
    await handler(eventEnvelope({ id: "inv_fail", lineItems: [] }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("createInvoice")
    expect(logger.error.mock.calls[0]![0]).toContain("inv_fail")
  })

  it("ignores null data", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    await subscriberFor(plugin, "invoice.issued").handler(eventEnvelope(null))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ignores data without id", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    await subscriberFor(plugin, "invoice.issued").handler(eventEnvelope({ noId: true }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts finance issued events that carry invoiceId", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger: makeLogger() })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        invoiceId: "inv_from_finance",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("supports event-specific default mapping hooks", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "ONLINE" }),
    )
    const plugin = smartbillPlugin({
      ...baseOptions,
      seriesName: (event) => (event.channel === "online" ? "ONLINE" : "A"),
      mentions: async (event) => `Invoice ${event.id}`,
      observations: "Paid by card",
      fetch: fetchMock,
      logger: makeLogger(),
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_online",
        channel: "online",
        clientName: "Test SRL",
        lineItems: [],
      }),
    )

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body.seriesName).toBe("ONLINE")
    expect(body.mentions).toBe("Invoice inv_online")
    expect(body.observations).toBe("Paid by card")
  })

  it("applies the SmartBill number when the finance event requires external allocation", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "42", series: "SB" }),
    )
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_external",
        externalAllocationRequired: true,
        invoiceNumber: "PENDING-INVOICE-abc",
        lineItems: [],
      }),
    )

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body.number).toBe("")
    expect(financeServiceMock.applyExternalInvoiceAllocation).toHaveBeenCalledWith(
      expect.anything(),
      "inv_external",
      { invoiceNumber: "SB-42" },
    )
  })

  it("keeps the SmartBill ref retryable when external allocation fails", async () => {
    financeServiceMock.applyExternalInvoiceAllocation.mockRejectedValueOnce(new Error("db down"))
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_external_retry",
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "SB",
          series: "SB",
          number: "42",
          documentType: "invoice",
        },
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "42", series: "SB" }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_external_retry",
        externalAllocationRequired: true,
        invoiceNumber: "PENDING-INVOICE-abc",
        lineItems: [],
      }),
    )

    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledOnce()
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_external_retry",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "42",
        status: "issued",
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("createInvoice"),
      expect.any(Error),
    )
  })

  it("skips duplicate create calls when a non-error SmartBill ref already exists", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_dup",
        provider: "smartbill",
        externalId: null,
        externalNumber: "1",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "A",
          series: "A",
          number: "1",
          documentType: "invoice",
        },
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      artifacts: { db: {} as never },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(eventEnvelope({ id: "inv_dup", lineItems: [] }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("already has SmartBill ref"),
      expect.objectContaining({ id: "iex_existing" }),
    )
  })

  it("repairs external allocation before skipping an existing SmartBill ref", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_dup_external",
        provider: "smartbill",
        externalId: null,
        externalNumber: "42",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "SB",
          series: "SB",
          number: "42",
          documentType: "invoice",
        },
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger: makeLogger(),
      artifacts: { db: {} as never },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_dup_external",
        externalAllocationRequired: true,
        invoiceNumber: "PENDING-INVOICE-abc",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(financeServiceMock.applyExternalInvoiceAllocation).toHaveBeenCalledWith(
      expect.anything(),
      "inv_dup_external",
      { invoiceNumber: "SB-42" },
    )
  })

  it("records a SmartBill error external ref and calls onError when create fails", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "boom"))
    const onError = vi.fn()
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      onError,
      artifacts: { db: {} as never },
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(eventEnvelope({ id: "inv_fail_ref", lineItems: [] }))

    expect(onError).toHaveBeenCalledOnce()
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_fail_ref",
      expect.objectContaining({
        provider: "smartbill",
        status: "error",
        syncError: expect.stringContaining("500"),
      }),
    )
  })
})

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
      .mockResolvedValueOnce(textResponse(503, "pdf unavailable"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
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

    expect(fetchMock).toHaveBeenCalledTimes(2)
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

describe("smartbillPlugin — invoice.voided subscriber", () => {
  it("calls cancelInvoice with external number", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(
      eventEnvelope({
        id: "inv_void",
        externalSeriesName: "B",
        externalNumber: "42",
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body).toEqual({
      companyVatCode: "RO12345678",
      seriesName: "B",
      number: "42",
    })
    expect(logger.info).toHaveBeenCalledOnce()
  })

  it("falls back to invoiceNumber when externalNumber missing", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(eventEnvelope({ id: "inv_void2", invoiceNumber: "99" }))

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body.seriesName).toBe("A") // falls back to options.seriesName
    expect(body.number).toBe("99")
  })

  it("logs error when no number is available", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(eventEnvelope({ id: "inv_no_num" }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("missing external number")
  })

  it("logs error on cancel failure (fire-and-forget)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "error"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(eventEnvelope({ id: "inv_err", externalNumber: "1" }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("cancelInvoice")
  })
})

describe("smartbillPlugin — invoice.external.sync.requested subscriber", () => {
  it("calls getPaymentStatus and logs result", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: true,
        invoiceTotalAmount: 100,
        paidAmount: 100,
        unpaidAmount: 0,
      }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_sync", externalNumber: "55" }))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice/paymentstatus")
    expect(logger.info).toHaveBeenCalledOnce()
    expect(logger.info.mock.calls[0]![0]).toContain("paid")
  })

  it("logs error when no number is available", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_no_num" }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("missing external number")
  })

  it("logs error on failure (fire-and-forget)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "timeout"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_err", externalNumber: "1" }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("getPaymentStatus")
  })
})

describe("smartbillPlugin — custom mapEvent", () => {
  it("uses custom mapper when provided", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const logger = makeLogger()
    const customMapper = vi.fn().mockReturnValue({
      companyVatCode: "CUSTOM",
      client: { name: "Custom" },
      seriesName: "Z",
      currency: "EUR",
      products: [],
    })
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      mapEvent: customMapper,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(eventEnvelope({ id: "inv_custom" }))

    expect(customMapper).toHaveBeenCalledOnce()
    expect(customMapper.mock.calls[0]![0].id).toBe("inv_custom")
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body.companyVatCode).toBe("CUSTOM")
  })
})
