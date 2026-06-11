import {
  type AdminExtension,
  type AdminWidgetContribution,
  defineAdminExtension,
} from "@voyantjs/admin"
// Importing the slot id also binds the bookings-ui `AdminDestinations`
// augmentation (`booking.detail`, `person.detail`, `organization.detail`,
// `invoice.detail`, `payment.detail`, ...) into this program — the finance
// pages navigate through those shared keys, and this package already
// peer-depends on `@voyantjs/bookings-react/ui`, so re-declaring them here would
// just duplicate the contract.
import {
  bookingDetailFinanceEndSlot,
  bookingDetailFinanceStartSlot,
  bookingDetailInvoicesTabSlot,
} from "@voyantjs/bookings-react/admin"
// Importing the slot id also binds the suppliers-ui `AdminDestinations`
// augmentation (`supplier.list`, `supplier.detail`) — this package already
// peer-depends on `@voyantjs/suppliers-react/ui`.
import { supplierDetailPaymentPolicySlot } from "@voyantjs/suppliers-react/admin"
import type { ComponentType } from "react"

import { BookingInvoicesWidget } from "./booking-invoices-widget.js"
import { BookingPaymentPolicyWidget } from "./booking-payment-policy-widget.js"
import { BookingPendingPaymentSessionsWidget } from "./booking-pending-payment-sessions-widget.js"
import { SupplierPaymentPolicyWidget } from "./supplier-payment-policy-widget.js"

/**
 * Semantic destinations the finance admin surfaces navigate to
 * (packaged-admin RFC §4.7). Keys shared with other domains
 * (`invoice.detail`, `booking.detail`, `person.detail`,
 * `organization.detail`, `payment.detail`) come from the bookings-ui
 * augmentation bound above; declared here are the finance-owned list
 * targets plus `supplier.detail`, re-declared shape-locked — also declared
 * by `@voyantjs/catalog-react/admin`, and interface merging requires the
 * member shape to stay identical across packages.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The invoices list page (the finance area's landing surface). */
    "invoice.list": Record<string, never>
    /** The payments list page. */
    "payment.list": Record<string, never>
    /** A supplier's detail page. */
    "supplier.detail": { supplierId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the operator-grade
// finance pages bound to their data wiring + semantic-destination
// navigation. Host route files only bind route params onto these.
export {
  BookingInvoicesWidget,
  type BookingInvoicesWidgetProps,
} from "./booking-invoices-widget.js"
export {
  BookingPaymentPolicyWidget,
  type BookingPaymentPolicyWidgetProps,
} from "./booking-payment-policy-widget.js"
export {
  BookingPendingPaymentSessionsWidget,
  type BookingPendingPaymentSessionsWidgetProps,
} from "./booking-pending-payment-sessions-widget.js"
export { CreditNoteDialog, type CreditNoteDialogProps } from "./credit-note-dialog.js"
export { InvoiceDetailHost, type InvoiceDetailHostProps } from "./invoice-detail-host.js"
export { InvoiceDetailSkeleton } from "./invoice-detail-skeleton.js"
export { LineItemDialog, type LineItemDialogProps } from "./line-item-dialog.js"
export { PaymentDetailHost, type PaymentDetailHostProps } from "./payment-detail-host.js"
export { PaymentDetailSkeleton } from "./payment-detail-skeleton.js"
export { PaymentDialog, type PaymentDialogProps } from "./payment-dialog.js"
export {
  RecordPaymentDialog,
  type RecordPaymentDialogProps,
} from "./record-payment-dialog.js"
export {
  SupplierPaymentPolicyWidget,
  type SupplierPaymentPolicyWidgetProps,
} from "./supplier-payment-policy-widget.js"

export interface CreateFinanceAdminExtensionOptions {
  /** Mount path of the finance pages inside the admin workspace. Default `/finance`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    invoices?: string
    invoiceNumberSeries?: string
    payments?: string
    supplierInvoices?: string
    profitability?: string
  }
}

/**
 * The finance admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Finance nav group (invoices, number
 * series, payments, supplier invoices, profitability) is part of the BASE
 * operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing nav entries here would duplicate them.
 * If the base nav ever drops the finance group, this extension is where the
 * entries move.
 *
 * ROUTES: contributions are metadata only — the finance pages carry no URL
 * search state. The PAGES are package-owned: {@link InvoiceDetailHost} and
 * {@link PaymentDetailHost} bind the operator-grade detail pages to their
 * data wiring (the shared finance provider context) and resolve every
 * cross-route link through the semantic destinations declared above; the
 * list pages (`InvoicesPage`, `PaymentsPage`, `SupplierInvoicesPage`,
 * `InvoiceNumberSeriesPage`, `ProfitabilityPage`) ship from the package
 * root. `component:` is intentionally NOT attached to these contributions
 * yet: the contribution contract renders zero-prop pages (route components
 * read params via the router, per RFC §4.2), while both detail hosts take
 * the record id as a prop. Host route files stay the thin binding layer
 * (`Route.useParams()` → host props) until the §4.2 code-based route
 * assembly gives packaged pages a router-agnostic way to read route state.
 *
 * WIDGETS: the cycle-resolution piece (RFC §4.7). The booking detail page
 * needs the finance-owned invoices card, but this package peer-depends on
 * `@voyantjs/bookings-react/ui`, so the bookings host cannot import it. Instead
 * this extension contributes {@link BookingInvoicesWidget} on the
 * `booking.details.invoices-tab` slot the bookings host exposes; the host
 * mounts its Invoices tab whenever a contribution targets that slot and
 * hands the widget its typed slot context as props. The Finance tab's
 * payment-links card ({@link BookingPendingPaymentSessionsWidget}) and
 * payment-policy override card ({@link BookingPaymentPolicyWidget}) travel
 * the same way on `booking.details.finance-start` / `…finance-end`. The
 * same pattern resolves the finance-ui ↔ suppliers-ui cycle: the supplier detail page's
 * customer-payment-policy card ships as {@link SupplierPaymentPolicyWidget}
 * on the `supplier.details.payment-policy` slot the supplier host exposes.
 */
export function createFinanceAdminExtension(
  options: CreateFinanceAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/finance", labels = {} } = options
  const {
    invoices = "Invoices",
    invoiceNumberSeries = "Number Series",
    payments = "Payments",
    supplierInvoices = "Supplier invoices",
    profitability = "Profitability",
  } = labels

  return defineAdminExtension({
    id: "finance",
    routes: [
      {
        id: "finance-invoices-index",
        path: `${basePath}/invoices`,
        title: invoices,
      },
      {
        id: "finance-invoices-detail",
        path: `${basePath}/invoices/$id`,
        title: invoices,
      },
      {
        id: "finance-invoice-number-series",
        path: `${basePath}/invoice-number-series`,
        title: invoiceNumberSeries,
      },
      {
        id: "finance-payments-index",
        path: `${basePath}/payments`,
        title: payments,
      },
      {
        id: "finance-payments-detail",
        path: `${basePath}/payments/$id`,
        title: payments,
      },
      {
        id: "finance-supplier-invoices-index",
        path: `${basePath}/supplier-invoices`,
        title: supplierInvoices,
      },
      {
        id: "finance-supplier-invoices-detail",
        path: `${basePath}/supplier-invoices/$id`,
        title: supplierInvoices,
      },
      {
        id: "finance-profitability",
        path: `${basePath}/profitability`,
        title: profitability,
      },
    ],
    widgets: [
      {
        id: "finance-booking-invoices",
        slot: bookingDetailInvoicesTabSlot,
        // The widget registry is untyped (`Record<string, unknown>` props);
        // the typed contract is `BookingDetailHostSlotContext`, which the
        // bookings host passes verbatim to this slot's widgets.
        component: BookingInvoicesWidget as unknown as ComponentType<Record<string, unknown>>,
      } satisfies AdminWidgetContribution,
      {
        id: "finance-booking-pending-payment-sessions",
        slot: bookingDetailFinanceStartSlot,
        // Same untyped-registry cast; the typed contract is
        // `BookingDetailHostSlotContext`, which the bookings host passes
        // verbatim to this slot's widgets.
        component: BookingPendingPaymentSessionsWidget as unknown as ComponentType<
          Record<string, unknown>
        >,
      } satisfies AdminWidgetContribution,
      {
        id: "finance-booking-payment-policy",
        slot: bookingDetailFinanceEndSlot,
        // Same untyped-registry cast; the typed contract is
        // `BookingDetailHostSlotContext`.
        component: BookingPaymentPolicyWidget as unknown as ComponentType<Record<string, unknown>>,
      } satisfies AdminWidgetContribution,
      {
        id: "finance-supplier-payment-policy",
        slot: supplierDetailPaymentPolicySlot,
        // Same untyped-registry cast; the typed contract is
        // `SupplierDetailHostSlotContext`, which the supplier detail host
        // passes verbatim to this slot's widgets.
        component: SupplierPaymentPolicyWidget as unknown as ComponentType<Record<string, unknown>>,
      } satisfies AdminWidgetContribution,
    ],
  })
}
