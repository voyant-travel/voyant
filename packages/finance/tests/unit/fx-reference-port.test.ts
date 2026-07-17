import { describe, expect, it, vi } from "vitest"

import {
  type FinanceFxReferenceRuntime,
  FinanceFxReferenceSourceUnavailableError,
  resolveReferenceRate,
} from "../../src/runtime-port.js"

describe("finance fx-reference port helper", () => {
  it("delegates to the host provider, which reports its own source", async () => {
    const provider: FinanceFxReferenceRuntime = {
      resolveReferenceRate: vi.fn(async ({ base, quote }) => ({
        rate: 4.97,
        source: "bnr",
        asOf: "2026-07-16",
        _echo: `${base}->${quote}`,
      })),
    }

    const rate = await resolveReferenceRate({
      provider,
      base: "EUR",
      quote: "RON",
      date: "2026-07-16",
    })

    expect(rate).toEqual({ rate: 4.97, source: "bnr", asOf: "2026-07-16", _echo: "EUR->RON" })
    expect(provider.resolveReferenceRate).toHaveBeenCalledWith({
      base: "EUR",
      quote: "RON",
      date: "2026-07-16",
    })

    await resolveReferenceRate({ provider, base: "USD", quote: "EUR" })
    expect(provider.resolveReferenceRate).toHaveBeenLastCalledWith({
      base: "USD",
      quote: "EUR",
      date: undefined,
    })
  })

  it("throws a typed unavailable error when no provider is wired", async () => {
    const call = () =>
      resolveReferenceRate({
        provider: null,
        base: "EUR",
        quote: "RON",
      })

    expect(call).toThrow(FinanceFxReferenceSourceUnavailableError)
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
