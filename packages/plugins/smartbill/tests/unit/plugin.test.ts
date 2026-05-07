import type { Plugin } from "@voyantjs/core"
import { describe, expect, it, vi } from "vitest"
import { smartbillPlugin } from "../../src/plugin.js"
import type { SmartbillFetch } from "../../src/types.js"

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
