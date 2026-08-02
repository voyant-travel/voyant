import { describe, expect, it } from "vitest"
import { smartbillVoyantPlugin } from "../../src/voyant.js"

describe("SmartBill deployment manifest", () => {
  it("declares stable identity, requirements, configuration, and runtime references", () => {
    expect(smartbillVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/plugin-smartbill",
      packageName: "@voyant-travel/plugin-smartbill",
      localId: "plugin-smartbill",
      runtime: {
        entry: "./graph-runtime",
        export: "createSmartbillVoyantRuntime",
      },
      runtimePorts: [{ id: "smartbill.runtime-host" }],
      provides: {
        capabilities: ["finance.external-invoicing", "finance.external-payment-sync"],
      },
      api: [
        {
          id: "@voyant-travel/plugin-smartbill#api.admin",
          openapi: { document: "smartbill" },
          runtime: {
            entry: "./graph-runtime",
            export: "createSmartbillVoyantRuntime",
          },
        },
      ],
      subscribers: [
        {
          id: "@voyant-travel/plugin-smartbill#subscriber.invoice-issued",
          eventType: "invoice.issued",
          source: "@voyant-travel/plugin-smartbill/subscriber-runtime",
          runtime: {
            entry: "./subscriber-runtime",
            export: "smartbillInvoiceIssuedSubscriber",
          },
        },
        {
          id: "@voyant-travel/plugin-smartbill#subscriber.proforma-issued",
          eventType: "invoice.proforma.issued",
          source: "@voyant-travel/plugin-smartbill/subscriber-runtime",
          runtime: {
            entry: "./subscriber-runtime",
            export: "smartbillProformaIssuedSubscriber",
          },
        },
        {
          id: "@voyant-travel/plugin-smartbill#subscriber.payment-recorded",
          eventType: "invoice.payment.recorded",
          source: "@voyant-travel/plugin-smartbill/subscriber-runtime",
          runtime: {
            entry: "./subscriber-runtime",
            export: "smartbillPaymentRecordedSubscriber",
          },
        },
      ],
      config: [
        { key: "companyVatCode", required: true },
        { key: "seriesName", required: true },
        { key: "invoiceSeriesName", required: false },
        { key: "proformaSeriesName", required: false },
        { key: "apiUrl", default: "https://ws.smartbill.ro/SBORO/api" },
        { key: "language", default: "RO" },
        { key: "art311SpecialRegime", default: false },
      ],
      secrets: [
        { key: "username", required: true, rotation: "replace-only" },
        { key: "apiToken", required: true, rotation: "replace-only" },
      ],
      meta: { ownership: "package", externalProvider: "smartbill" },
    })
  })
})
