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
} from "./plugin-test-helpers.js"

describe("smartbillPlugin — invoice.proforma.converted subscriber", () => {
  it("converts the SmartBill proforma into the new invoice and registers the invoice ref", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "42", series: "SB" }),
    )
    financeServiceMock.listInvoiceExternalRefs.mockImplementation(async (_db, invoiceId) => {
      if (invoiceId === "inv_new") return []
      if (invoiceId === "proforma_123") {
        return [
          {
            id: "iex_proforma",
            invoiceId: "proforma_123",
            provider: "smartbill",
            externalId: "7",
            externalNumber: "7",
            externalUrl: "https://smartbill.example/estimate/7",
            status: "issued",
            syncError: null,
            metadata: { documentType: "proforma", seriesName: "PF", number: "7" },
          },
        ]
      }
      return []
    })
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger,
    })
    const handler = subscriberFor(plugin, "invoice.proforma.converted").handler

    await handler(
      eventEnvelope({
        id: "inv_new",
        proformaId: "proforma_123",
        proformaInvoiceNumber: "PF-7",
        clientName: "Test SRL",
        currency: "RON",
        lineItems: [{ name: "Tour", quantity: 1, unitPrice: 50000 }],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice")
    const body = JSON.parse(init.body ?? "{}")
    expect(body.useEstimateDetails).toBe(true)
    expect(body.estimate).toEqual({ seriesName: "PF", number: "7" })
    expect(body.seriesName).toBe("A")
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_new",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "42",
        metadata: expect.objectContaining({ documentType: "invoice", seriesName: "A" }),
      }),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("proforma converted"),
      expect.objectContaining({ number: "42", series: "SB" }),
    )
  })

  it("falls back to creating an invoice when the proforma has no SmartBill ref", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "43", series: "SB" }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: {} as never },
      logger,
    })

    await subscriberFor(plugin, "invoice.proforma.converted").handler(
      eventEnvelope({
        id: "inv_new",
        proformaId: "proforma_missing_ref",
        lineItems: [],
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice")
    const body = JSON.parse(init.body ?? "{}")
    expect(body.useEstimateDetails).toBeUndefined()
    expect(body.estimate).toBeUndefined()
    expect(financeServiceMock.registerInvoiceExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      "inv_new",
      expect.objectContaining({
        provider: "smartbill",
        externalNumber: "43",
        metadata: expect.objectContaining({ documentType: "invoice", seriesName: "A" }),
      }),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("falling back to createInvoice"),
    )
    expect(logger.error).not.toHaveBeenCalled()
  })
})
