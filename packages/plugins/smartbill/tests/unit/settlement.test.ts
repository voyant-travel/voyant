import { describe, expect, it, vi } from "vitest"

import { createSmartbillInvoiceSettlementPoller } from "../../src/settlement.js"
import type { SmartbillFetch } from "../../src/types.js"

function jsonResponse(status: number, body: unknown) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
    arrayBuffer: async () => {
      const bytes = new TextEncoder().encode(text)
      const copy = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(copy).set(bytes)
      return copy
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null,
    },
  }
}

const okEnvelope = { status: "Ok", message: "", errorText: "" }

describe("createSmartbillInvoiceSettlementPoller", () => {
  it("queries SmartBill and normalizes paid amounts to cents", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: true,
        invoiceTotalAmount: 123.45,
        paidAmount: 123.45,
        unpaidAmount: 0,
      }),
    )

    const poller = createSmartbillInvoiceSettlementPoller({
      username: "user@test.com",
      apiToken: "token",
      fetch: fetchMock,
      companyVatCode: "RO12345678",
      seriesName: "SB",
    })

    const result = await poller({
      db: null as never,
      invoice: { invoiceNumber: "INV-1" } as never,
      externalRef: {
        externalId: "ext-1",
        externalNumber: "1001",
        metadata: null,
      } as never,
      bindings: {},
    })

    expect(result).toMatchObject({
      externalId: "ext-1",
      externalNumber: "1001",
      status: "paid",
      paidAmountCents: 12345,
      unpaidAmountCents: 0,
      syncError: null,
      metadata: {
        companyVatCode: "RO12345678",
        seriesName: "SB",
      },
    })
    expect(result.settledAt).toBeTruthy()
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice/paymentstatus?cif=RO12345678&seriesname=SB&number=1001")
  })

  it("falls back to external-ref metadata and returns sync errors for missing config", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: false,
        invoiceTotalAmount: 10,
        paidAmount: 0,
        unpaidAmount: 10,
      }),
    )

    const poller = createSmartbillInvoiceSettlementPoller({
      username: "user@test.com",
      apiToken: "token",
      fetch: fetchMock,
    })

    const success = await poller({
      db: null as never,
      invoice: { invoiceNumber: "INV-2" } as never,
      externalRef: {
        externalId: null,
        externalNumber: null,
        metadata: {
          companyVatCode: "RO99887766",
          seriesName: "PR",
          number: "77",
        },
      } as never,
      bindings: {},
    })

    expect(success).toMatchObject({
      externalNumber: "77",
      status: "unpaid",
      paidAmountCents: 0,
      unpaidAmountCents: 1000,
      syncError: null,
    })
    expect(success.settledAt).toBeNull()

    const missingConfig = await poller({
      db: null as never,
      invoice: { invoiceNumber: "INV-3" } as never,
      externalRef: {
        externalId: null,
        externalNumber: null,
        metadata: null,
      } as never,
      bindings: {},
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(missingConfig.syncError).toContain("companyVatCode")
  })

  it("supports option-level seriesName callbacks", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: false,
        invoiceTotalAmount: 10,
        paidAmount: 0,
        unpaidAmount: 10,
      }),
    )
    const seriesName = vi.fn(async ({ invoice }) =>
      invoice.invoiceNumber.startsWith("WEB") ? "WEB" : "SB",
    )
    const poller = createSmartbillInvoiceSettlementPoller({
      username: "user@test.com",
      apiToken: "token",
      fetch: fetchMock,
      companyVatCode: "RO12345678",
      seriesName,
    })

    await poller({
      db: null as never,
      invoice: { invoiceNumber: "WEB-1" } as never,
      externalRef: {
        externalId: null,
        externalNumber: "1001",
        metadata: null,
      } as never,
      bindings: {},
    })

    expect(seriesName).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("seriesname=WEB")
  })
})
