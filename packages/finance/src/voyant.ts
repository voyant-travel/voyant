import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import {
  financeAccommodationsPaymentPolicyRuntimePort,
  financeCheckoutPaymentStartersRuntimePort,
  financeCruisesPaymentPolicyRuntimePort,
  financeDistributionPaymentPolicyRuntimePort,
  financeHostRuntimePort,
  financeInventoryPaymentPolicyRuntimePort,
  financeInvoiceSettlementPollerRuntimePort,
  financeNotificationsRuntimePort,
  financeOperatorSettingsRuntimePort,
} from "./runtime-port.js"

const financeAdminRuntime = {
  entry: "@voyant-travel/finance-react/admin",
  export: "createFinanceAdminExtension",
} as const

/** Import-cheap deployment declaration owned by the finance package. */
export const financeVoyantModule = defineModule({
  id: "@voyant-travel/finance",
  packageName: "@voyant-travel/finance",
  localId: "finance",
  runtime: { entry: "@voyant-travel/finance", export: "createFinanceVoyantRuntime" },
  runtimePorts: [
    requirePort(financeHostRuntimePort),
    requirePort(financeNotificationsRuntimePort),
    requirePort(financeCheckoutPaymentStartersRuntimePort, { optional: true }),
    requirePort(financeInvoiceSettlementPollerRuntimePort, {
      optional: true,
      cardinality: "many",
    }),
  ],
  provides: { capabilities: ["finance.payment-sessions"] },
  api: [
    {
      id: "@voyant-travel/finance#api.admin",
      surface: "admin",
      mount: "finance",
      openapi: { document: "finance" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createFinanceHonoModule",
      },
    },
    {
      id: "@voyant-travel/finance#api.public",
      surface: "public",
      mount: "finance",
      openapi: { document: "finance" },
      anonymous: [
        "/bookings",
        "/collections",
        "/payment-sessions",
        "/accountant",
        "/travel-credits",
      ],
      transactional: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createFinanceHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/finance#schema",
      source: "@voyant-travel/finance/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/finance#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/finance#linkable.creditNote",
      source: "@voyant-travel/finance/linkables",
    },
    {
      id: "@voyant-travel/finance#linkable.invoice",
      source: "@voyant-travel/finance/linkables",
    },
    {
      id: "@voyant-travel/finance#linkable.invoiceTemplate",
      source: "@voyant-travel/finance/linkables",
    },
    {
      id: "@voyant-travel/finance#linkable.supplierInvoice",
      source: "@voyant-travel/finance/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/finance#event.invoice.issued",
      eventType: "invoice.issued",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.proforma.issued",
      eventType: "invoice.proforma.issued",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.proforma.converted",
      eventType: "invoice.proforma.converted",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.voided",
      eventType: "invoice.voided",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.settled",
      eventType: "invoice.settled",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.rendered",
      eventType: "invoice.rendered",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.document.generated",
      eventType: "invoice.document.generated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.invoice.payment.recorded",
      eventType: "invoice.payment.recorded",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.payment.completed",
      eventType: "payment.completed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking.created",
      eventType: "booking.created",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking.confirmed",
      eventType: "booking.confirmed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking.dual-created",
      eventType: "booking.dual-created",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking-create.rejected",
      eventType: "booking_create.rejected",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking.contract-document.requested",
      eventType: "booking.contract_document.requested",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
    {
      id: "@voyant-travel/finance#event.booking-payment-schedule.paid",
      eventType: "booking_payment_schedule.paid",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "finance", category: "domain" },
    },
  ],
  setupMigrations: [
    {
      id: "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
      source: "@voyant-travel/finance/setup/travel-credits",
      runtime: {
        entry: "@voyant-travel/finance/setup/travel-credits",
        export: "runTravelCreditSetupMigration",
      },
      dependsOn: ["@voyant-travel/finance#migrations"],
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/finance#access.finance",
        resource: "finance",
        actions: ["read", "write", "refund", "void"],
      },
      {
        id: "@voyant-travel/finance#access.transactions",
        resource: "transactions",
        actions: ["read", "write"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/finance#tool.list-invoices",
      name: "list_invoices",
      runtime: { entry: "@voyant-travel/finance/tools", export: "listInvoicesTool" },
      requiredScopes: ["finance:read"],
      context: ["finance"],
    },
    {
      id: "@voyant-travel/finance#tool.get-invoice",
      name: "get_invoice",
      runtime: { entry: "@voyant-travel/finance/tools", export: "getInvoiceTool" },
      requiredScopes: ["finance:read"],
      context: ["finance"],
    },
    {
      id: "@voyant-travel/finance#tool.void-invoice",
      name: "void_invoice",
      runtime: { entry: "@voyant-travel/finance/tools", export: "voidInvoiceTool" },
      requiredScopes: ["finance:void"],
      context: ["finance"],
    },
  ],
  admin: {
    compositionOrder: 40,
    runtime: {
      entry: "@voyant-travel/finance-react/admin",
      export: "createSelectedFinanceAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/finance#admin.copy",
        namespace: "finance.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/finance-react/i18n",
          export: "financeUiMessageDefinitions",
        },
      },
    ],
    routes: (
      [
        ["index", "/finance"],
        ["invoices-index", "/finance/invoices"],
        ["invoices-detail", "/finance/invoices/$id"],
        ["invoice-number-series", "/finance/invoice-number-series"],
        ["payments-index", "/finance/payments"],
        ["payments-detail", "/finance/payments/$id"],
        ["supplier-invoices-index", "/finance/supplier-invoices"],
        ["supplier-invoices-detail", "/finance/supplier-invoices/$id"],
        ["profitability", "/finance/profitability"],
      ] as const
    ).map(([id, path]) => ({
      id: `@voyant-travel/finance#admin.route.${id}`,
      path,
      runtime: financeAdminRuntime,
    })),
    contributions: (
      [
        ["booking-payment-controller", "booking.details.payment-controller"],
        ["booking-invoices", "booking.details.invoices-tab"],
        ["booking-pending-payment-sessions", "booking.details.finance-start"],
        ["booking-payment-policy", "booking.details.finance-end"],
        ["supplier-payment-policy", "supplier.details.payment-policy"],
      ] as const
    ).map(([id, slotId]) => ({
      id: `@voyant-travel/finance#admin.contribution.${id}`,
      slotId,
      runtime: financeAdminRuntime,
    })),
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const financeBookingTaxVoyantPlugin = defineExtension({
  id: "@voyant-travel/finance#booking-tax-extension",
  packageName: "@voyant-travel/finance",
  localId: "finance.booking-tax-extension",
  runtime: { entry: "@voyant-travel/finance", export: "createBookingTaxVoyantRuntime" },
  runtimePorts: [requirePort(financeOperatorSettingsRuntimePort)],
  api: [
    {
      id: "@voyant-travel/finance#booking-tax-extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "booking-tax" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createBookingTaxHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const financeBookingsCreateVoyantPlugin = defineExtension({
  id: "@voyant-travel/finance#bookings-create-extension",
  packageName: "@voyant-travel/finance",
  localId: "finance.bookings-create-extension",
  api: [
    {
      id: "@voyant-travel/finance#bookings-create-extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "bookingsCreateExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const financeBookingScheduleVoyantPlugin = defineExtension({
  id: "@voyant-travel/finance#booking-schedule-extension",
  packageName: "@voyant-travel/finance",
  localId: "finance.booking-schedule-extension",
  runtime: {
    entry: "@voyant-travel/finance",
    export: "createBookingScheduleVoyantRuntime",
  },
  runtimePorts: [
    requirePort(financeHostRuntimePort),
    requirePort(financeOperatorSettingsRuntimePort),
    requirePort(financeDistributionPaymentPolicyRuntimePort),
    requirePort(financeAccommodationsPaymentPolicyRuntimePort),
    requirePort(financeCruisesPaymentPolicyRuntimePort),
    requirePort(financeInventoryPaymentPolicyRuntimePort),
  ],
  api: [
    {
      id: "@voyant-travel/finance#booking-schedule-extension.api.admin",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createBookingScheduleHonoExtension",
      },
    },
    {
      id: "@voyant-travel/finance#booking-schedule-extension.api.public",
      surface: "public",
      mount: "payment-policy",
      openapi: { document: "bookings" },
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createBookingScheduleHonoExtension",
      },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/finance#subscriber.booking-schedule-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/finance/booking-schedule-subscriber",
      runtime: {
        entry: "./booking-schedule-subscriber",
        export: "bookingScheduleConfirmedSubscriber",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default financeVoyantModule
