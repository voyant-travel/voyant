import { describe, expect, it } from "vitest"
import {
  financeBookingScheduleVoyantPlugin,
  financeBookingsCreateVoyantPlugin,
  financeBookingTaxVoyantPlugin,
  financeVoyantModule,
} from "../../src/voyant.js"

describe("finance deployment manifest", () => {
  it("owns the module deployment surfaces", () => {
    expect(financeVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/finance",
      packageName: "@voyant-travel/finance",
      api: [
        {
          id: "@voyant-travel/finance#api.admin",
          surface: "admin",
          runtime: { entry: "@voyant-travel/finance", export: "createFinanceHonoModule" },
        },
        {
          id: "@voyant-travel/finance#api.public",
          surface: "public",
          anonymous: ["/bookings", "/collections", "/payment-sessions", "/accountant", "/vouchers"],
          runtime: { entry: "@voyant-travel/finance", export: "createFinanceHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/finance#schema" }],
      migrations: [{ id: "@voyant-travel/finance#migrations" }],
      setupMigrations: [
        {
          id: "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
          runtime: {
            entry: "@voyant-travel/finance/setup/vouchers",
            export: "runVoucherSetupMigration",
          },
          dependsOn: ["@voyant-travel/finance#migrations"],
        },
      ],
      links: [
        { id: "@voyant-travel/finance#linkable.creditNote" },
        { id: "@voyant-travel/finance#linkable.invoice" },
        { id: "@voyant-travel/finance#linkable.invoiceTemplate" },
        { id: "@voyant-travel/finance#linkable.supplierInvoice" },
      ],
    })
  })

  it("owns the finance extensions", () => {
    expect([financeBookingTaxVoyantPlugin, financeBookingsCreateVoyantPlugin]).toMatchObject([
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/finance#booking-tax-extension",
        api: [
          {
            runtime: {
              entry: "@voyant-travel/finance",
              export: "createBookingTaxHonoExtension",
            },
          },
        ],
      },
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/finance#bookings-create-extension",
        api: [
          {
            runtime: { entry: "@voyant-travel/finance", export: "bookingsCreateExtension" },
          },
        ],
      },
    ])
  })

  it("owns the booking schedule bridge with package runtime references", () => {
    expect(financeBookingScheduleVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/finance#booking-schedule-extension",
      packageName: "@voyant-travel/finance",
      api: [
        {
          id: "@voyant-travel/finance#booking-schedule-extension.api.admin",
          surface: "admin",
          mount: "bookings",
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
    })
    expect(financeBookingScheduleVoyantPlugin.subscribers?.[0]).not.toHaveProperty("runtime")
  })

  it("declares finance routes and existing cross-package widgets", () => {
    expect(financeVoyantModule.admin?.routes?.map(({ id, path }) => [id, path])).toEqual([
      ["@voyant-travel/finance#admin.route.index", "/finance"],
      ["@voyant-travel/finance#admin.route.invoices-index", "/finance/invoices"],
      ["@voyant-travel/finance#admin.route.invoices-detail", "/finance/invoices/$id"],
      [
        "@voyant-travel/finance#admin.route.invoice-number-series",
        "/finance/invoice-number-series",
      ],
      ["@voyant-travel/finance#admin.route.payments-index", "/finance/payments"],
      ["@voyant-travel/finance#admin.route.payments-detail", "/finance/payments/$id"],
      ["@voyant-travel/finance#admin.route.supplier-invoices-index", "/finance/supplier-invoices"],
      [
        "@voyant-travel/finance#admin.route.supplier-invoices-detail",
        "/finance/supplier-invoices/$id",
      ],
      ["@voyant-travel/finance#admin.route.profitability", "/finance/profitability"],
    ])
    expect(financeVoyantModule.admin?.contributions?.map(({ id, slotId }) => [id, slotId])).toEqual(
      [
        [
          "@voyant-travel/finance#admin.contribution.booking-invoices",
          "booking.details.invoices-tab",
        ],
        [
          "@voyant-travel/finance#admin.contribution.booking-pending-payment-sessions",
          "booking.details.finance-start",
        ],
        [
          "@voyant-travel/finance#admin.contribution.booking-payment-policy",
          "booking.details.finance-end",
        ],
        [
          "@voyant-travel/finance#admin.contribution.supplier-payment-policy",
          "supplier.details.payment-policy",
        ],
      ],
    )
  })
})
