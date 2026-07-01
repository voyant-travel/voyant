import { describe, expect, it } from "vitest"

import { createOperatorInvoiceExchangeRateResolver } from "./operator-runtime-adapter"

describe("createOperatorInvoiceExchangeRateResolver", () => {
  it("disables Voyant Data FX when no API key is configured", () => {
    expect(createOperatorInvoiceExchangeRateResolver({})).toBeUndefined()
    expect(createOperatorInvoiceExchangeRateResolver({ VOYANT_API_KEY: "" })).toBeUndefined()
    expect(createOperatorInvoiceExchangeRateResolver({ VOYANT_API_KEY: "   " })).toBeUndefined()
  })

  it("does not treat a local broad Cloud placeholder as a Voyant Data key", () => {
    expect(
      createOperatorInvoiceExchangeRateResolver({ VOYANT_API_KEY: "local-dev" }),
    ).toBeUndefined()
  })

  it("uses a configured Voyant Data API key", () => {
    const resolver = createOperatorInvoiceExchangeRateResolver({
      VOYANT_DATA_API_KEY: "vd_test",
      VOYANT_CLOUD_API_URL: "https://api.example.test",
    })

    expect(resolver).toEqual(expect.any(Function))
  })

  it("keeps the broad Cloud key as a legacy Data key in Cloud admin auth mode", () => {
    const resolver = createOperatorInvoiceExchangeRateResolver({
      VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
      VOYANT_API_KEY: "vc_test",
      VOYANT_CLOUD_API_URL: "https://api.example.test",
    })

    expect(resolver).toEqual(expect.any(Function))
  })
})
