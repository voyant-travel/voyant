import { describe, expect, it, vi } from "vitest"

import { createSmartbillClient } from "../../src/client.js"
import type { SmartbillFetch } from "../../src/types.js"

function jsonResponse(status: number, body: unknown) {
  const text = JSON.stringify(body)
  return makeResponse(status, text, "application/json; charset=utf-8")
}

function textResponse(status: number, text: string) {
  return makeResponse(status, text, "text/plain")
}

function pdfResponse(status: number, bytes: Uint8Array, contentType = "application/pdf") {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("not json")
    },
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => {
      const copy = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(copy).set(bytes)
      return copy
    },
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
  }
}

function makeResponse(status: number, text: string, contentType: string) {
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
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
  }
}

const baseOptions = {
  username: "user@example.com",
  apiToken: "test-token",
}

const okEnvelope = { status: "Ok", message: "", errorText: "" }

describe("createSmartbillClient.createInvoice", () => {
  it("sends POST to /invoice with basic auth and returns the live envelope", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A", url: "https://x/y.pdf" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.createInvoice({
      companyVatCode: "RO123",
      client: { name: "Acme" },
      seriesName: "A",
      currency: "RON",
      products: [
        {
          name: "Tour",
          measureUnit: "buc",
          quantity: 1,
          price: 100,
          currency: "RON",
          isTaxIncluded: true,
        },
      ],
    })
    expect(result).toEqual({
      ...okEnvelope,
      number: "1",
      series: "A",
      url: "https://x/y.pdf",
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/invoice")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toMatch(/^Basic /)
    expect(init.headers["Content-Type"]).toBe("application/json")
    const body = JSON.parse(init.body ?? "{}")
    expect(body.companyVatCode).toBe("RO123")
    expect(body.products).toHaveLength(1)
  })

  it("throws on non-2xx response", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(400, "bad request"))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await expect(
      client.createInvoice({
        companyVatCode: "RO123",
        client: { name: "X" },
        seriesName: "A",
        currency: "RON",
        products: [],
      }),
    ).rejects.toThrow(/SmartBill createInvoice failed \(400\)/)
  })

  it("throws when the live envelope reports an error", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { status: "Error", message: "", errorText: "Series not found" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await expect(
      client.createInvoice({
        companyVatCode: "RO123",
        client: { name: "X" },
        seriesName: "MISSING",
        currency: "RON",
        products: [],
      }),
    ).rejects.toThrow(/SmartBill createInvoice failed: Series not found/)
  })
})

describe("createSmartbillClient.createProforma", () => {
  it("sends POST to /estimate", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "P1", series: "P" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await client.createProforma({
      companyVatCode: "RO123",
      client: { name: "X" },
      seriesName: "P",
      currency: "RON",
      products: [],
    })
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/estimate")
  })
})

describe("createSmartbillClient.cancelInvoice", () => {
  it("sends PUT to /invoice/cancel", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.cancelInvoice("RO123", "A", "42")
    expect(result.status).toBe("Ok")
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/invoice/cancel")
    expect(init.method).toBe("PUT")
    const body = JSON.parse(init.body ?? "{}")
    expect(body).toEqual({ companyVatCode: "RO123", seriesName: "A", number: "42" })
  })

  it("throws on error", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "fail"))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.cancelInvoice("RO123", "A", "1")).rejects.toThrow(
      /SmartBill cancelInvoice failed \(500\)/,
    )
  })
})

describe("createSmartbillClient.restoreInvoice", () => {
  it("sends PUT to /invoice/restore", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await client.restoreInvoice("RO123", "A", "7")
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/invoice/restore")
    expect(init.method).toBe("PUT")
  })
})

describe("createSmartbillClient.deleteInvoice", () => {
  it("sends DELETE to /invoice with query params", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await client.deleteInvoice("RO123", "A", "42")
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice?cif=RO123&seriesname=A&number=42")
    expect(init.method).toBe("DELETE")
  })
})

describe("createSmartbillClient.reverseInvoice", () => {
  it("sends PUT to /invoice/reverse", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "S1", series: "S" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.reverseInvoice("RO123", "A", "42")
    expect(result).toMatchObject({ number: "S1", series: "S", status: "Ok" })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/invoice/reverse")
    expect(init.method).toBe("PUT")
  })
})

describe("createSmartbillClient PDF endpoints", () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

  it("returns PDF bytes from /invoice/pdf", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      pdfResponse(200, pdfBytes, "application/octet-stream"),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.viewInvoicePdf("RO123", "A", "42")
    expect(result.contentType).toBe("application/octet-stream")
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(result.bytes)).toEqual(Array.from(pdfBytes))
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice/pdf?cif=RO123&seriesname=A&number=42")
    expect(init.method).toBe("GET")
    expect(init.headers.Accept).toBe("application/octet-stream")
  })

  it("returns PDF bytes from /estimate/pdf", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => pdfResponse(200, pdfBytes))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.viewEstimatePdf("RO123", "P", "5")
    expect(result.contentType).toBe("application/pdf")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/estimate/pdf?cif=RO123&seriesname=P&number=5")
  })

  it("falls back to application/pdf when no content-type header is exposed", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => null,
      text: async () => "",
      arrayBuffer: async () => {
        const copy = new ArrayBuffer(pdfBytes.byteLength)
        new Uint8Array(copy).set(pdfBytes)
        return copy
      },
    }))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.viewInvoicePdf("RO123", "A", "1")
    expect(result.contentType).toBe("application/pdf")
  })

  it("throws on non-2xx PDF response", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(404, "not found"))
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.viewInvoicePdf("RO123", "A", "missing")).rejects.toThrow(
      /SmartBill viewInvoicePdf failed \(404\)/,
    )
  })
})

describe("createSmartbillClient.getPaymentStatus", () => {
  it("returns the live paymentstatus envelope including paid bool and payments list", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: true,
        invoiceTotalAmount: 100,
        paidAmount: 100,
        unpaidAmount: 0,
        payments: [{ type: "Card", value: 100, paidDate: "2026-05-07" }],
      }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.getPaymentStatus("RO123", "A", "42")
    expect(result.paid).toBe(true)
    expect(result.paidAmount).toBe(100)
    expect(result.unpaidAmount).toBe(0)
    expect(result.payments).toEqual([{ type: "Card", value: 100, paidDate: "2026-05-07" }])
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice/paymentstatus?cif=RO123&seriesname=A&number=42")
  })
})

describe("createSmartbillClient list endpoints", () => {
  it("listTaxes returns the live tax envelope", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, taxes: [{ name: "Normala", percentage: 19 }] }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.listTaxes()
    expect(result.taxes).toEqual([{ name: "Normala", percentage: 19 }])
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ws.smartbill.ro/SBORO/api/tax")
  })

  it("listSeries returns the live series envelope with single-letter type codes", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        list: [
          { name: "FCT", nextNumber: 5, type: "f" },
          { name: "PRF", nextNumber: 2, type: "p" },
        ],
      }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.listSeries()
    expect(result.list?.map((entry) => entry.type)).toEqual(["f", "p"])
  })

  it("listEstimateInvoices includes areInvoicesCreated and converted invoice list", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        series: "A",
        number: "1",
        areInvoicesCreated: true,
        invoices: [{ ...okEnvelope, series: "A", number: "1" }],
      }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.listEstimateInvoices("RO123", "P", "1")
    expect(result.areInvoicesCreated).toBe(true)
    expect(result.invoices).toHaveLength(1)
  })
})

describe("createSmartbillClient — custom apiUrl", () => {
  it("respects custom API base URL", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const client = createSmartbillClient({
      ...baseOptions,
      apiUrl: "https://custom.example.com/api/",
      fetch: fetchMock,
    })
    await client.cancelInvoice("RO1", "A", "1")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://custom.example.com/api/invoice/cancel")
  })
})

describe("createSmartbillClient — basic auth encoding", () => {
  it("encodes username:token as base64", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(200, okEnvelope))
    const client = createSmartbillClient({
      username: "test@test.com",
      apiToken: "secret123",
      fetch: fetchMock,
    })
    await client.cancelInvoice("X", "A", "1")
    const [, init] = fetchMock.mock.calls[0]!
    const expected = `Basic ${btoa("test@test.com:secret123")}`
    expect(init.headers.Authorization).toBe(expected)
  })
})

describe("createSmartbillClient — fetch handling", () => {
  it("throws when no fetch implementation is available", async () => {
    const originalFetch = globalThis.fetch
    // biome-ignore lint/suspicious/noExplicitAny: stubbing global fetch
    ;(globalThis as any).fetch = undefined
    try {
      // biome-ignore lint/suspicious/noExplicitAny: simulating missing fetch
      const client = createSmartbillClient({ ...baseOptions, fetch: undefined as any })
      await expect(client.cancelInvoice("X", "A", "1")).rejects.toThrow(
        /requires a fetch implementation/,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
