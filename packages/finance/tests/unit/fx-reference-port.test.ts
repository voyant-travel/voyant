import { describe, expect, it, vi } from "vitest"

import {
  type FinanceFxReferenceRuntime,
  FinanceFxReferenceSourceUnavailableError,
  resolveReferenceRate,
} from "../../src/runtime-port.js"

describe("finance fx-reference port helper", () => {
  it("delegates to the host provider with the operator's configured source", async () => {
    const provider: FinanceFxReferenceRuntime = {
      resolveReferenceRate: vi.fn(async ({ base, quote, source }) => ({
        rate: source === "bnr" ? 4.97 : 5.01,
        source,
        asOf: "2026-07-16",
        _echo: `${base}->${quote}`,
      })),
    }

    const bnr = await resolveReferenceRate({
      provider,
      source: "bnr",
      base: "EUR",
      quote: "RON",
      date: "2026-07-16",
    })

    expect(bnr).toEqual({ rate: 4.97, source: "bnr", asOf: "2026-07-16", _echo: "EUR->RON" })
    expect(provider.resolveReferenceRate).toHaveBeenCalledWith({
      base: "EUR",
      quote: "RON",
      date: "2026-07-16",
      source: "bnr",
    })

    const ecb = await resolveReferenceRate({
      provider,
      source: "ecb",
      base: "USD",
      quote: "EUR",
    })
    expect(ecb.source).toBe("ecb")
    expect(ecb.rate).toBe(5.01)
    expect(provider.resolveReferenceRate).toHaveBeenLastCalledWith({
      base: "USD",
      quote: "EUR",
      date: undefined,
      source: "ecb",
    })
  })

  it("throws a typed unavailable error when no provider is wired", async () => {
    const call = () =>
      resolveReferenceRate({
        provider: null,
        source: "bnr",
        base: "EUR",
        quote: "RON",
      })

    expect(call).toThrow(FinanceFxReferenceSourceUnavailableError)
    expect(call).toThrow(/bnr/)
    try {
      call()
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceFxReferenceSourceUnavailableError)
      expect((error as FinanceFxReferenceSourceUnavailableError).code).toBe(
        "finance_fx_reference_source_unavailable",
      )
    }
  })
})
