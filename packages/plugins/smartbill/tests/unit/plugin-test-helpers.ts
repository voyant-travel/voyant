import type { Plugin } from "@voyant-travel/core"
import { beforeEach, vi } from "vitest"
import { financeServiceMock } from "./plugin-test-setup.js"

export type { SmartbillFetch } from "../../src/types.js"
export { financeServiceMock } from "./plugin-test-setup.js"

export function eventEnvelope<T>(data: T) {
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

export function jsonResponse(status: number, body: unknown) {
  return makeResponse(status, JSON.stringify(body), true)
}

export function textResponse(status: number, text: string) {
  return makeResponse(status, text, false)
}

export function bytesResponse(status: number, bytes: Uint8Array, contentType = "application/pdf") {
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

export const okEnvelope = { status: "Ok", message: "", errorText: "" }

export const baseOptions = {
  username: "user@test.com",
  apiToken: "tok",
  companyVatCode: "RO12345678",
  seriesName: "A",
}

export function makeLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
  }
}

export function subscriberFor(plugin: Plugin, event: string) {
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
  financeServiceMock.updateInvoice.mockResolvedValue({ id: "inv_123" })
  financeServiceMock.listInvoiceAttachments.mockResolvedValue([])
  financeServiceMock.createInvoiceRendition.mockResolvedValue({ id: "invr_1" })
  financeServiceMock.createInvoiceAttachment.mockResolvedValue({
    id: "inva_1",
    storageKey: "invoices/inv_123/smartbill/invoice-A-1.pdf",
  })
  financeServiceMock.ensureExternalInvoiceNumberSeries.mockResolvedValue([])
})
