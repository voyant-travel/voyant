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

export default financeVoyantModule
