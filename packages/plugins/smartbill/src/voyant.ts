import { definePlugin, requirePort } from "@voyant-travel/core/project"
import { smartbillRuntimeHostPort } from "./runtime-port.js"

const PACKAGE_ID = "@voyant-travel/plugin-smartbill"

const smartbillAdminApi = {
  id: `${PACKAGE_ID}#api.admin`,
  surface: "admin" as const,
  mount: "smartbill",
  openapi: { document: "smartbill" },
  transactional: true,
  runtime: {
    entry: "./graph-runtime",
    export: "createSmartbillVoyantRuntime",
  },
}

/** Import-cheap deployment declaration owned by the SmartBill plugin package. */
export const smartbillVoyantPlugin = definePlugin({
  id: PACKAGE_ID,
  packageName: PACKAGE_ID,
  localId: "plugin-smartbill",
  runtime: {
    entry: "./graph-runtime",
    export: "createSmartbillVoyantRuntime",
  },
  runtimePorts: [requirePort(smartbillRuntimeHostPort)],
  provides: {
    capabilities: ["finance.external-invoicing", "finance.external-payment-sync"],
  },
  api: [smartbillAdminApi],
  subscribers: [
    {
      id: `${PACKAGE_ID}#subscriber.invoice-issued`,
      eventType: "invoice.issued",
      source: `${PACKAGE_ID}/subscriber-runtime`,
      runtime: {
        entry: "./subscriber-runtime",
        export: "smartbillInvoiceIssuedSubscriber",
      },
    },
    {
      id: `${PACKAGE_ID}#subscriber.proforma-issued`,
      eventType: "invoice.proforma.issued",
      source: `${PACKAGE_ID}/subscriber-runtime`,
      runtime: {
        entry: "./subscriber-runtime",
        export: "smartbillProformaIssuedSubscriber",
      },
    },
    {
      id: `${PACKAGE_ID}#subscriber.payment-recorded`,
      eventType: "invoice.payment.recorded",
      source: `${PACKAGE_ID}/subscriber-runtime`,
      runtime: {
        entry: "./subscriber-runtime",
        export: "smartbillPaymentRecordedSubscriber",
      },
    },
  ],
  config: [
    {
      id: `${PACKAGE_ID}#config.company-vat-code`,
      key: "companyVatCode",
      required: true,
    },
    {
      id: `${PACKAGE_ID}#config.series-name`,
      key: "seriesName",
      required: true,
    },
    {
      id: `${PACKAGE_ID}#config.invoice-series-name`,
      key: "invoiceSeriesName",
      required: false,
    },
    {
      id: `${PACKAGE_ID}#config.proforma-series-name`,
      key: "proformaSeriesName",
      required: false,
    },
    {
      id: `${PACKAGE_ID}#config.api-url`,
      key: "apiUrl",
      default: "https://ws.smartbill.ro/SBORO/api",
    },
    {
      id: `${PACKAGE_ID}#config.language`,
      key: "language",
      default: "RO",
    },
    {
      id: `${PACKAGE_ID}#config.art-311-special-regime`,
      key: "art311SpecialRegime",
      default: false,
    },
  ],
  secrets: [
    {
      id: `${PACKAGE_ID}#secret.username`,
      key: "username",
      required: true,
      description: "SmartBill account username.",
      rotation: "replace-only",
    },
    {
      id: `${PACKAGE_ID}#secret.api-token`,
      key: "apiToken",
      required: true,
      description: "SmartBill API token.",
      rotation: "replace-only",
    },
  ],
  resources: [
    {
      id: `${PACKAGE_ID}#resource.api`,
      kind: "http-service",
      required: true,
      config: { service: "smartbill-api" },
    },
    {
      id: `${PACKAGE_ID}#resource.database`,
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
    {
      id: `${PACKAGE_ID}#resource.document-storage`,
      kind: "object-storage",
      required: false,
      capabilities: ["private-documents"],
    },
  ],
  meta: {
    ownership: "package",
    externalProvider: "smartbill",
  },
})

export default smartbillVoyantPlugin
