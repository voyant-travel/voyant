import { describe, expect, it } from "vitest"

import {
  BookingInvoicesWidget,
  CreditNoteDialog,
  createFinanceAdminExtension,
  InvoiceDetailHost,
  InvoiceDetailSkeleton,
  LineItemDialog,
  PaymentDetailHost,
  PaymentDetailSkeleton,
  PaymentDialog,
  RecordPaymentDialog,
  SupplierPaymentPolicyWidget,
} from "./index.js"

describe("createFinanceAdminExtension", () => {
  it("contributes no navigation (finance nav is base-nav-owned)", () => {
    const extension = createFinanceAdminExtension()
    expect(extension.id).toBe("finance")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the finance routes with unique ids and paths", () => {
    const extension = createFinanceAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(8)
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length)
    expect(routes.map((route) => route.path)).toEqual([
      "/finance/invoices",
      "/finance/invoices/$id",
      "/finance/invoice-number-series",
      "/finance/payments",
      "/finance/payments/$id",
      "/finance/supplier-invoices",
      "/finance/supplier-invoices/$id",
      "/finance/profitability",
    ])
  })

  it("honors basePath and labels", () => {
    const extension = createFinanceAdminExtension({
      basePath: "/financiar",
      labels: { invoices: "Facturi", payments: "Plati" },
    })
    const invoicesIndex = extension.routes?.find((route) => route.id === "finance-invoices-index")
    expect(invoicesIndex?.path).toBe("/financiar/invoices")
    expect(invoicesIndex?.title).toBe("Facturi")
    const paymentsDetail = extension.routes?.find((route) => route.id === "finance-payments-detail")
    expect(paymentsDetail?.path).toBe("/financiar/payments/$id")
    expect(paymentsDetail?.title).toBe("Plati")
  })

  it("does not attach components to route contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; both finance detail
    // hosts take the record id as a prop, so host route files stay the
    // binding layer until the RFC §4.2 code-based route assembly lands.
    const extension = createFinanceAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })

  it("contributes the booking invoices card on the bookings invoices-tab slot", () => {
    // The finance-ui ↔ bookings-ui cycle resolution: bookings-ui cannot be
    // imported into this package's dependents' booking page, so the card
    // arrives as a widget contribution the bookings host renders.
    const extension = createFinanceAdminExtension()
    const widgets = extension.widgets ?? []
    expect(widgets).toHaveLength(2)
    expect(widgets[0]?.slot).toBe("booking.details.invoices-tab")
    expect(widgets[0]?.component).toBe(BookingInvoicesWidget)
  })

  it("contributes the payment-policy card on the supplier detail slot", () => {
    // Same cycle resolution for finance-ui ↔ suppliers-ui: the supplier
    // detail host cannot import this package, so the customer-payment-policy
    // card arrives as a widget contribution the supplier host renders.
    const extension = createFinanceAdminExtension()
    const widget = extension.widgets?.find(
      (candidate) => candidate.id === "finance-supplier-payment-policy",
    )
    expect(widget?.slot).toBe("supplier.details.payment-policy")
    expect(widget?.component).toBe(SupplierPaymentPolicyWidget)
  })
})

describe("packaged finance admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts and dialogs as components from the admin entrypoint", () => {
    for (const host of [
      BookingInvoicesWidget,
      CreditNoteDialog,
      InvoiceDetailHost,
      InvoiceDetailSkeleton,
      LineItemDialog,
      PaymentDetailHost,
      PaymentDetailSkeleton,
      PaymentDialog,
      RecordPaymentDialog,
      SupplierPaymentPolicyWidget,
    ]) {
      expect(typeof host).toBe("function")
    }
  })
})
