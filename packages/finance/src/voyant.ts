import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the finance package. */
export const financeVoyantModule = defineModule({
  id: "@voyant-travel/finance",
  packageName: "@voyant-travel/finance",
  localId: "finance",
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
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const financeBookingTaxVoyantPlugin = definePlugin({
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

export const financeBookingsCreateVoyantPlugin = definePlugin({
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

export const financeBookingScheduleVoyantPlugin = definePlugin({
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
  meta: {
    ownership: "package",
  },
})

export default financeVoyantModule
