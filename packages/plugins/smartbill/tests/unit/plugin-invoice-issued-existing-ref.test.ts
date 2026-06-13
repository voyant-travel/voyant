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
  it("keeps the SmartBill ref retryable when external allocation fails", async () => {
    financeServiceMock.applyExternalInvoiceAllocation.mockRejectedValueOnce(
      Object.assign(new Error("Invoice number already exists"), {
        code: "invoice_number_conflict",
        invoiceNumber: "SB-42",
      }),
    )
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

    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledTimes(2)
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "inv_external_retry",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "42",
        status: "issued",
      }),
    )
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "inv_external_retry",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "42",
        status: "issued",
        syncError: expect.stringContaining("invoice_number_conflict"),
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("createInvoice"),
      expect.any(Error),
    )
  })

  it("skips duplicate create calls when a non-error SmartBill ref already exists with a local sync error", async () => {
    financeServiceMock.listInvoiceExternalRefs.mockResolvedValueOnce([
      {
        id: "iex_existing",
        invoiceId: "inv_dup",
        provider: "smartbill",
        externalId: null,
        externalNumber: "1",
        externalUrl: null,
        status: "issued",
        syncError: "invoice_number_conflict: Invoice number already exists",
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
