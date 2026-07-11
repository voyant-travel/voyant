import { defineExtension, defineModule } from "@voyant-travel/core/project"

const financeAdminRuntime = {
  entry: "@voyant-travel/finance-react/admin",
  export: "createFinanceAdminExtension",
} as const

/** Import-cheap deployment declaration owned by the finance package. */
export const financeVoyantModule = defineModule({
  id: "@voyant-travel/finance",
  packageName: "@voyant-travel/finance",
  localId: "finance",
  provides: { capabilities: ["finance.payment-sessions"] },
  api: [
    {
      id: "@voyant-travel/finance#api.admin",
      surface: "admin",
      mount: "finance",
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
      anonymous: ["/bookings", "/collections", "/payment-sessions", "/accountant", "/vouchers"],
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
    { id: "@voyant-travel/finance#event.invoice.issued", eventType: "invoice.issued" },
    {
      id: "@voyant-travel/finance#event.invoice.proforma.issued",
      eventType: "invoice.proforma.issued",
    },
    {
      id: "@voyant-travel/finance#event.invoice.proforma.converted",
      eventType: "invoice.proforma.converted",
    },
    { id: "@voyant-travel/finance#event.invoice.voided", eventType: "invoice.voided" },
    { id: "@voyant-travel/finance#event.invoice.settled", eventType: "invoice.settled" },
    { id: "@voyant-travel/finance#event.invoice.rendered", eventType: "invoice.rendered" },
    {
      id: "@voyant-travel/finance#event.invoice.document.generated",
      eventType: "invoice.document.generated",
    },
    {
      id: "@voyant-travel/finance#event.invoice.payment.recorded",
      eventType: "invoice.payment.recorded",
    },
    { id: "@voyant-travel/finance#event.payment.completed", eventType: "payment.completed" },
    { id: "@voyant-travel/finance#event.booking.created", eventType: "booking.created" },
    { id: "@voyant-travel/finance#event.booking.confirmed", eventType: "booking.confirmed" },
    {
      id: "@voyant-travel/finance#event.booking.dual-created",
      eventType: "booking.dual-created",
    },
    {
      id: "@voyant-travel/finance#event.booking-create.rejected",
      eventType: "booking_create.rejected",
    },
    {
      id: "@voyant-travel/finance#event.booking.contract-document.requested",
      eventType: "booking.contract_document.requested",
    },
    {
      id: "@voyant-travel/finance#event.booking-payment-schedule.paid",
      eventType: "booking_payment_schedule.paid",
    },
  ],
  setupMigrations: [
    {
      id: "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
      source: "@voyant-travel/finance/setup/vouchers",
      runtime: {
        entry: "@voyant-travel/finance/setup/vouchers",
        export: "runVoucherSetupMigration",
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
    ],
  },
  tools: [
    {
      id: "@voyant-travel/finance#tool.list-invoices",
      name: "list_invoices",
      runtime: { entry: "@voyant-travel/finance/tools", export: "listInvoicesTool" },
      requiredScopes: ["finance:read"],
    },
    {
      id: "@voyant-travel/finance#tool.get-invoice",
      name: "get_invoice",
      runtime: { entry: "@voyant-travel/finance/tools", export: "getInvoiceTool" },
      requiredScopes: ["finance:read"],
    },
    {
      id: "@voyant-travel/finance#tool.void-invoice",
      name: "void_invoice",
      runtime: { entry: "@voyant-travel/finance/tools", export: "voidInvoiceTool" },
      requiredScopes: ["finance:void"],
    },
  ],
  admin: {
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
  api: [
    {
      id: "@voyant-travel/finance#booking-tax-extension.api",
      surface: "admin",
      mount: "bookings",
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
  api: [
    {
      id: "@voyant-travel/finance#booking-schedule-extension.api.admin",
      surface: "admin",
      mount: "bookings",
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
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default financeVoyantModule
