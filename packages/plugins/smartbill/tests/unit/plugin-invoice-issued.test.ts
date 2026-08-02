import "./plugin-test-setup.js"
import { describe, expect, it, vi } from "vitest"
import { smartbillPlugin } from "../../src/plugin.js"
import {
  baseOptions,
  eventEnvelope,
  financeServiceMock,
  jsonResponse,
  makeLogger,
  okEnvelope,
  type SmartbillFetch,
  subscriberFor,
  textResponse,
} from "./plugin-test-helpers.js"

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

  it("skips generic invoice.issued events for proforma conversions", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_from_proforma",
        convertedFromInvoiceId: "proforma_123",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("skipping invoice create"))
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

  it("applies an externally seeded SmartBill number without prepending the configured series", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_external_seeded",
        provider: "smartbill",
        externalId: "remote_A0250",
        externalNumber: "A0250",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: null,
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "ignored", series: "ignored" }),
    )
    const dbResolver = vi.fn(() => ({}))
    const plugin = smartbillPlugin({
      ...baseOptions,
      seriesName: "B",
      fetch: fetchMock,
      artifacts: { db: dbResolver as never },
      logger: makeLogger(),
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_external_seeded",
        externalAllocationRequired: true,
        invoiceNumber: "PENDING-INVOICE-abc",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(financeServiceMock.applyExternalInvoiceAllocation).toHaveBeenCalledWith(
      expect.anything(),
      "inv_external_seeded",
      { invoiceNumber: "A0250" },
    )
    expect(dbResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({ number: "A0250", series: undefined }),
      }),
    )
  })

  it("writes the SmartBill series-number back to the invoice when configured", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "0127", series: "B" }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger,
      writeBackInvoiceNumber: true,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_write_back",
        invoiceNumber: "PRO-BK-2605-5728",
        lineItems: [],
      }),
    )

    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_write_back",
      {
        invoiceNumber: "B-0127",
      },
    )
    expect(logger.info).toHaveBeenCalledWith(
      "[smartbill] invoice number write-back applied for inv_write_back",
      expect.objectContaining({ id: "inv_123" }),
    )
  })

  it("uses a custom SmartBill invoice number write-back formatter", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "0127", series: "B" }),
    )
    const writeBackInvoiceNumber = vi.fn(async (event, result) => {
      return `${event.id}/${result.series}/${result.number}`
    })
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
      writeBackInvoiceNumber,
    })
    const handler = subscriberFor(plugin, "invoice.proforma.issued").handler

    await handler(
      eventEnvelope({
        id: "proforma_write_back",
        invoiceNumber: "PRO-BK-2605-5728",
        lineItems: [],
      }),
    )

    expect(writeBackInvoiceNumber).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proforma_write_back" }),
      expect.objectContaining({ number: "0127", series: "B" }),
    )
    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "proforma_write_back",
      { invoiceNumber: "proforma_write_back/B/0127" },
    )
  })

  it("writes the SmartBill invoice number back from an existing external ref", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_existing_write_back",
        provider: "smartbill",
        externalId: "0127",
        externalNumber: "0127",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "B",
          series: "B",
          number: "0127",
          documentType: "invoice",
        },
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "ignored", series: "ignored" }),
    )
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
      writeBackInvoiceNumber: true,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_existing_write_back",
        invoiceNumber: "PRO-BK-2605-5728",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_existing_write_back",
      { invoiceNumber: "B-0127" },
    )
  })

  it("writes an externally seeded SmartBill number back without prepending the configured series", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_seeded_write_back",
        provider: "smartbill",
        externalId: "remote_A0250",
        externalNumber: "A0250",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: null,
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "ignored", series: "ignored" }),
    )
    const plugin = smartbillPlugin({
      ...baseOptions,
      seriesName: "B",
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
      writeBackInvoiceNumber: true,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_seeded_write_back",
        invoiceNumber: "A0250",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_seeded_write_back",
      { invoiceNumber: "A0250" },
    )
  })

  it("uses a custom write-back formatter for an externally seeded SmartBill ref", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_seeded_custom_write_back",
        provider: "smartbill",
        externalId: "remote_A0250",
        externalNumber: "A0250",
        externalUrl: "https://smartbill.test/invoice/A0250",
        status: "issued",
        syncError: null,
        metadata: null,
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "ignored", series: "ignored" }),
    )
    const writeBackInvoiceNumber = vi.fn(async (_event, result) => {
      return `external/${result.number}`
    })
    const plugin = smartbillPlugin({
      ...baseOptions,
      seriesName: "B",
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
      writeBackInvoiceNumber,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_seeded_custom_write_back",
        invoiceNumber: "A0250",
        lineItems: [],
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(writeBackInvoiceNumber).toHaveBeenCalledWith(
      expect.objectContaining({ id: "inv_seeded_custom_write_back" }),
      expect.objectContaining({
        number: "A0250",
        series: undefined,
        url: "https://smartbill.test/invoice/A0250",
      }),
    )
    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_seeded_custom_write_back",
      { invoiceNumber: "external/A0250" },
    )
  })

  it("ignores existing SmartBill refs for a different document type when writing back", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing_proforma",
        invoiceId: "inv_write_back_mismatch",
        provider: "smartbill",
        externalId: "0009",
        externalNumber: "0009",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: {
          companyVatCode: "RO12345678",
          seriesName: "PF",
          series: "PF",
          number: "0009",
          documentType: "proforma",
        },
      },
    ])
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "0127", series: "B" }),
    )
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger: makeLogger(),
      writeBackInvoiceNumber: true,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(
      eventEnvelope({
        id: "inv_write_back_mismatch",
        invoiceNumber: "PRO-BK-2605-5728",
        lineItems: [],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(financeServiceMock.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      "inv_write_back_mismatch",
      { invoiceNumber: "B-0127" },
    )
  })
})
