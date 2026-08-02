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

  it("uses the stored SmartBill ref and marks it cancelled", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const logger = makeLogger()
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "inex_1",
        invoiceId: "inv_void_ref",
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.example/42",
        status: "issued",
        syncError: null,
        metadata: { series: "B", number: "42", documentType: "invoice" },
      },
    ])
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      artifacts: { db: {} as never },
    })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(eventEnvelope({ id: "inv_void_ref" }))

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body).toMatchObject({
      companyVatCode: "RO12345678",
      seriesName: "B",
      number: "42",
    })
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      {},
      "inv_void_ref",
      expect.objectContaining({
        provider: "smartbill",
        externalId: "42",
        externalNumber: "42",
        externalUrl: "https://smartbill.example/42",
        status: "cancelled",
        syncError: null,
        metadata: expect.objectContaining({
          seriesName: "B",
          series: "B",
          number: "42",
          documentType: "invoice",
          cancelStatus: "Ok",
        }),
      }),
    )
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

  it("logs error and records sync failure on cancel failure", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "error"))
    const logger = makeLogger()
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValue([
      {
        id: "inex_1",
        invoiceId: "inv_err",
        provider: "smartbill",
        externalId: "1",
        externalNumber: "1",
        externalUrl: null,
        status: "issued",
        syncError: null,
        metadata: { seriesName: "A", number: "1", documentType: "invoice" },
      },
    ])
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      // Keep the retried cancel 500s fast in tests.
      resilience: { retry: { baseDelayMs: 0, maxDelayMs: 1 } },
      artifacts: { db: {} as never },
    })
    const handler = subscriberFor(plugin, "invoice.voided").handler

    await handler(eventEnvelope({ id: "inv_err", externalNumber: "1" }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("cancelInvoice")
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      {},
      "inv_err",
      expect.objectContaining({
        provider: "smartbill",
        externalId: "1",
        externalNumber: "1",
        status: "issued",
        syncError: expect.stringContaining("SmartBill cancelInvoice failed"),
        metadata: expect.objectContaining({ documentType: "invoice" }),
      }),
    )
  })
})
