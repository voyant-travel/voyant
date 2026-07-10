import { describe, expect, it } from "vitest"
import {
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
          runtime: { entry: "@voyant-travel/finance", export: "createFinanceHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/finance#schema" }],
      migrations: [{ id: "@voyant-travel/finance#migrations" }],
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
        schemaVersion: "voyant.plugin.v1",
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
        schemaVersion: "voyant.plugin.v1",
        id: "@voyant-travel/finance#bookings-create-extension",
        api: [
          {
            runtime: { entry: "@voyant-travel/finance", export: "bookingsCreateExtension" },
          },
        ],
      },
    ])
  })
})
