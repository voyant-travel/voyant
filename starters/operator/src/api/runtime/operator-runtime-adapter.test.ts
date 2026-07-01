import { describe, expect, it } from "vitest"

import { createOperatorInvoiceExchangeRateResolver } from "./operator-runtime-adapter"

describe("createOperatorInvoiceExchangeRateResolver", () => {
  it("disables Voyant Data FX when no API key is configured", () => {
    expect(createOperatorInvoiceExchangeRateResolver({})).toBeUndefined()
    expect(createOperatorInvoiceExchangeRateResolver({ VOYANT_API_KEY: "" })).toBeUndefined()
    expect(createOperatorInvoiceExchangeRateResolver({ VOYANT_API_KEY: "   " })).toBeUndefined()
  })

  it("uses a configured Voyant API key", () => {
    const resolver = createOperatorInvoiceExchangeRateResolver({
      VOYANT_API_KEY: "vc_test",
      VOYANT_CLOUD_API_URL: "https://api.example.test",
    })

    expect(resolver).toEqual(expect.any(Function))
  })
})
