import { describe, expect, it } from "vitest"
import {
  createOperatorInvoiceSettlementPollers,
  operatorSmartbillRuntimeHost,
  resolveOperatorSmartbillConfig,
} from "./operator-runtime-adapter"

const configuredBindings = {
  SMARTBILL_USERNAME: " billing@example.test ",
  SMARTBILL_API_TOKEN: " secret ",
  SMARTBILL_COMPANY_VAT_CODE: " RO12345678 ",
  SMARTBILL_SERIES_NAME: " SB ",
  SMARTBILL_INVOICE_SERIES_NAME: " INV ",
  SMARTBILL_PROFORMA_SERIES_NAME: " PRO ",
  SMARTBILL_API_URL: " https://smartbill.test/api ",
  SMARTBILL_LANGUAGE: " RO ",
  SMARTBILL_ART_311_SPECIAL_REGIME: "true",
}

describe("Operator SmartBill Node host", () => {
  it("maps deployment bindings to the package runtime config", () => {
    expect(resolveOperatorSmartbillConfig(configuredBindings)).toEqual({
      username: "billing@example.test",
      apiToken: "secret",
      companyVatCode: "RO12345678",
      seriesName: "INV",
      invoiceSeriesName: "INV",
      proformaSeriesName: "PRO",
      apiUrl: "https://smartbill.test/api",
      language: "RO",
      art311SpecialRegime: true,
    })
    expect(resolveOperatorSmartbillConfig({})).toBeNull()
  })

  it("exposes only typed host capabilities and package-owned pollers", () => {
    expect(operatorSmartbillRuntimeHost.resolveConfig(configuredBindings)).toEqual(
      resolveOperatorSmartbillConfig(configuredBindings),
    )
    expect(createOperatorInvoiceSettlementPollers({})).toEqual({})
    expect(createOperatorInvoiceSettlementPollers(configuredBindings)).toHaveProperty("smartbill")
  })
})
