// agent-quality: file-size exception -- owner: plugins; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { CircuitOpenError, createCircuitBreaker } from "@voyant-travel/utils/resilience"
import { describe, expect, it, vi } from "vitest"

import {
  createSmartbillClient,
  SmartbillApiError,
  SmartbillRateLimitCircuitOpenError,
  SmartbillRateLimitError,
} from "../../src/client.js"
import type { SmartbillFetch } from "../../src/types.js"

/** Keeps retrying tests fast and deterministic (no real backoff sleeps). */
const fastRetry = { retry: { baseDelayMs: 0, maxDelayMs: 1 } }

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

  it("strips deprecated product measureUnit before sending to /estimate", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "P1", series: "P" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })
    const body = {
      companyVatCode: "RO123",
      client: { name: "X" },
      seriesName: "P",
      currency: "RON",
      products: [
        {
          name: "Tour",
          measuringUnitName: "buc",
          measureUnit: "buc",
          quantity: 1,
          price: 100,
          currency: "RON",
          isTaxIncluded: true,
        },
      ],
    }

    await client.createProforma(body)

    const [, init] = fetchMock.mock.calls[0]!
    const requestBody = JSON.parse(init.body ?? "{}")
    expect(requestBody.products[0].measuringUnitName).toBe("buc")
    expect(requestBody.products[0].measureUnit).toBeUndefined()
    expect(body.products[0]!.measureUnit).toBe("buc")
  })
})

describe("createSmartbillClient.convertEstimateToInvoice", () => {
  it("creates an invoice using SmartBill estimate details", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "42", series: "SB" }),
    )
    const client = createSmartbillClient({ ...baseOptions, fetch: fetchMock })

    await client.convertEstimateToInvoice("RO123", "PF", "7", {
      companyVatCode: "RO123",
      client: { name: "X" },
      seriesName: "SB",
      currency: "RON",
      products: [],
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://ws.smartbill.ro/SBORO/api/invoice")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body ?? "{}")
    expect(body).toMatchObject({
      companyVatCode: "RO123",
      seriesName: "SB",
      useEstimateDetails: true,
      estimate: { seriesName: "PF", number: "7" },
      useStock: false,
    })
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

  it("throws on error (after exhausting retries)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "fail"))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: fastRetry,
    })
    await expect(client.cancelInvoice("RO123", "A", "1")).rejects.toThrow(
      /SmartBill cancelInvoice failed \(500\)/,
    )
    // Cancel is an idempotent PUT — 5xx retries, final response is surfaced.
    expect(fetchMock).toHaveBeenCalledTimes(3)
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
    // biome-ignore lint/suspicious/noExplicitAny: stubbing global fetch -- owner: plugins; existing suppression is intentional pending typed cleanup.
    ;(globalThis as any).fetch = undefined
    try {
      // biome-ignore lint/suspicious/noExplicitAny: simulating missing fetch -- owner: plugins; existing suppression is intentional pending typed cleanup.
      const client = createSmartbillClient({ ...baseOptions, fetch: undefined as any })
      await expect(client.cancelInvoice("X", "A", "1")).rejects.toThrow(
        /requires a fetch implementation/,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe("createSmartbillClient — resilience", () => {
  it("retries a 503 GET and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn<SmartbillFetch>()
      .mockResolvedValueOnce(textResponse(503, "unavailable"))
      .mockResolvedValueOnce(jsonResponse(200, { ...okEnvelope, taxes: [] }))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: fastRetry,
    })
    expect(await client.listTaxes()).toMatchObject({ status: "Ok" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry createInvoice POST on 503 (no idempotency keys)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(503, "unavailable"))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: fastRetry,
    })
    await expect(
      client.createInvoice({
        companyVatCode: "RO123",
        client: { name: "X" },
        seriesName: "A",
        currency: "RON",
        products: [],
      }),
    ).rejects.toThrow(/SmartBill createInvoice failed \(503\)/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("does not retry reverseInvoice despite the PUT (issues a new reversal invoice)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(503, "unavailable"))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: fastRetry,
    })
    await expect(client.reverseInvoice("RO123", "A", "42")).rejects.toBeInstanceOf(
      SmartbillApiError,
    )
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("fails fast with CircuitOpenError once the breaker trips", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 60_000 })
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "down"))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: { breaker, retry: false },
    })

    await expect(client.listTaxes()).rejects.toThrow(/SmartBill listTaxes failed \(500\)/)
    expect(fetchMock).toHaveBeenCalledOnce()

    // Breaker is open now: no network call, fail fast.
    await expect(client.listTaxes()).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe("createSmartbillClient — SmartBill rate limits", () => {
  const rateLimitBody = {
    key: "!.oresp@&",
    successfully: false,
    errorText:
      "Ai depasit limita maxima de requesturi admisa. Vei putea executa alte requesturi dupa 10 min de la momentul blocarii 24/05/2026 09:32:48",
    errorCode: "0",
    cooldown: 0,
  }

  it("throws a typed rate-limit error with retry timing from SmartBill text", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(403, rateLimitBody))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      rateLimit: {
        now: () => new Date("2026-05-24T09:33:48.000Z"),
      },
    })

    await expect(client.listEstimateInvoices("RO123", "P", "1")).rejects.toMatchObject({
      name: "SmartbillRateLimitError",
      operation: "listEstimateInvoices",
      status: 403,
      retryAfterMs: 540_000,
      blockedAt: new Date("2026-05-24T09:32:48.000Z"),
      retryAfterAt: new Date("2026-05-24T09:42:48.000Z"),
    })
    await expect(client.listEstimateInvoices("RO123", "P", "1")).rejects.toBeInstanceOf(
      SmartbillRateLimitError,
    )
  })

  it("opens an opt-in local circuit after a rate-limit response", async () => {
    let now = new Date("2026-05-24T09:33:48.000Z")
    const fetchMock = vi.fn<SmartbillFetch>(async () => jsonResponse(403, rateLimitBody))
    const client = createSmartbillClient({
      ...baseOptions,
      fetch: fetchMock,
      rateLimit: {
        circuitBreaker: true,
        now: () => now,
      },
    })

    await expect(client.listTaxes()).rejects.toBeInstanceOf(SmartbillRateLimitError)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(client.listSeries()).rejects.toBeInstanceOf(SmartbillRateLimitCircuitOpenError)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    now = new Date("2026-05-24T09:42:48.000Z")
    fetchMock.mockResolvedValueOnce(jsonResponse(200, okEnvelope))

    await expect(client.listSeries()).resolves.toEqual(okEnvelope)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
