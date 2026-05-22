import { describe, expect, it, vi } from "vitest"

import {
  createInvoiceFxRoutes,
  createVoyantDataFxExchangeRateResolver,
  resolveInvoiceFxContext,
} from "../../src/invoice-fx.js"

describe("invoice FX", () => {
  it("resolves invoice FX context from operator settings", async () => {
    const context = await resolveInvoiceFxContext(
      {} as never,
      { currency: "eur", issueDate: "2026-05-22" },
      {
        invoiceFxSettings: {
          baseCurrency: "ron",
          fxCommissionBps: 200,
          fxCommissionInvoiceMention: "2% comision curs risc valutar",
        },
        resolveInvoiceExchangeRate: async () => 4.97,
      },
    )

    expect(context).toEqual({
      baseCurrency: "RON",
      fxRate: 4.97,
      fxCommissionBps: 200,
      effectiveRate: 5.0694,
      fxCommissionInvoiceMention: "2% comision curs risc valutar",
    })
  })

  it("omits FX context when exchange-rate resolution fails", async () => {
    const error = new Error("FX provider timeout")
    const onInvoiceFxResolutionError = vi.fn()
    const context = await resolveInvoiceFxContext(
      {} as never,
      { currency: "eur", issueDate: "2026-05-22" },
      {
        invoiceFxSettings: {
          baseCurrency: "ron",
          fxCommissionBps: 200,
        },
        resolveInvoiceExchangeRate: async () => {
          throw error
        },
        onInvoiceFxResolutionError,
      },
    )

    expect(context).toBeNull()
    expect(onInvoiceFxResolutionError).toHaveBeenCalledWith(error, {
      baseCurrency: "EUR",
      quoteCurrency: "RON",
      date: "2026-05-22",
    })
  })

  it("uses the Voyant Data FX pair route for exchange-rate resolution", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ conversionRate: 4.97 }), {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    })
    const apiKey = `data_${"key"}`
    const resolve = createVoyantDataFxExchangeRateResolver({
      apiKey,
      baseUrl: "https://data.test",
      fetch,
    })

    await expect(resolve({ baseCurrency: "EUR", quoteCurrency: "RON" })).resolves.toBe(4.97)

    const [url, init] = fetch.mock.calls[0]!
    expect(String(url)).toBe("https://data.test/data/fx/v1/fx/pair/EUR/RON")
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${apiKey}`)
    expect(new Headers(init?.headers).get("x-voyant-sdk")).toBe("voyant-finance")
  })

  it("exposes configured exchange-rate resolution through the admin route", async () => {
    const resolveInvoiceExchangeRate = vi.fn(async () => 4.97)
    const app = createInvoiceFxRoutes({ resolveInvoiceExchangeRate })

    const response = await app.request(
      "/invoice-fx-rate?baseCurrency=eur&quoteCurrency=ron&date=2026-05-22",
    )
    const body = (await response.json()) as {
      data: { baseCurrency: string; quoteCurrency: string; date: string; rate: number }
    }

    expect(response.status).toBe(200)
    expect(resolveInvoiceExchangeRate).toHaveBeenCalledWith({
      baseCurrency: "EUR",
      quoteCurrency: "RON",
      date: "2026-05-22",
    })
    expect(body.data).toEqual({
      baseCurrency: "EUR",
      quoteCurrency: "RON",
      date: "2026-05-22",
      rate: 4.97,
    })
  })
})
