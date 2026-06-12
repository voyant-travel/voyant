import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminWidgetContribution,
  adminRoutePageModule,
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
import { defaultFetcher } from "@voyantjs/react"
// Importing the slot id also binds the suppliers-ui `AdminDestinations`
// augmentation (`supplier.list`, `supplier.detail`) — this package already
// peer-depends on `@voyantjs/suppliers-react/ui`.
import { supplierDetailPaymentPolicySlot } from "@voyantjs/suppliers-react/admin"
import type { ComponentType } from "react"

// Skeletons are deliberately the ONLY page-adjacent statics this factory
// touches: they ship from their own light modules, so attaching them as
// `pendingComponent` doesn't pull the heavy page chunks into the factory.
import { InvoicesPageSkeleton } from "../components/invoices-page-skeleton.js"
import { PaymentsPageSkeleton } from "../components/payments-page-skeleton.js"
// Query options live in the package data root — static imports here stay in
// the data layer and never reference the page components.
import {
  getAllPaymentsQueryOptions,
  getDepartureProfitabilityQueryOptions,
  getInvoiceCreditNotesQueryOptions,
  getInvoiceLineItemsQueryOptions,
  getInvoiceNotesQueryOptions,
  getInvoiceNumberSeriesQueryOptions,
  getInvoicePaymentsQueryOptions,
  getInvoiceQueryOptions,
  getInvoicesQueryOptions,
  getPaymentQueryOptions,
} from "../index.js"
import { BookingInvoicesWidget } from "./booking-invoices-widget.js"
import { BookingPaymentPolicyWidget } from "./booking-payment-policy-widget.js"
import { BookingPendingPaymentSessionsWidget } from "./booking-pending-payment-sessions-widget.js"
import { InvoiceDetailSkeleton } from "./invoice-detail-skeleton.js"
import { PaymentDetailSkeleton } from "./payment-detail-skeleton.js"
import { SupplierPaymentPolicyWidget } from "./supplier-payment-policy-widget.js"

/** The host runtime as the package's query-option client (`fetchWithValidation`). */
function runtimeClient(runtime: AdminRouteLoaderContext["runtime"]) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}

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
 * ROUTES: six of the eight contributions carry the FULL route implementation
 * (packaged-admin RFC §4.8 endgame) — a lazy `page` module loader, a data
 * loader fed by the host runtime (`baseUrl` + cookie-forwarding fetcher),
 * `ssr: "data-only"`, and the pending skeleton where the operator route had
 * one — so the host needs no per-route files for them. Pages stay
 * code-split: this factory never references a page component statically;
 * each `page:` dynamically imports its specific module (never a barrel), and
 * param-taking pages read the matched `$id` off `AdminRoutePageProps` and
 * bind it onto {@link InvoiceDetailHost} / {@link PaymentDetailHost}.
 * Cross-route links resolve through the semantic destinations declared
 * above. The two supplier-invoices contributions remain metadata-only — see
 * their inline notes.
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
        // Route-backed destination (RFC §4.7 endgame): the key resolves by
        // pure path interpolation of this route, so the host's resolver is
        // generated (`voyant admin generate --destinations`).
        destination: "invoice.list",
        ssr: "data-only",
        page: () => import("./pages/invoices-index.js"),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(getInvoicesQueryOptions(runtimeClient(runtime))),
        pendingComponent: InvoicesPageSkeleton,
      },
      {
        id: "finance-invoices-detail",
        path: `${basePath}/invoices/$id`,
        title: invoices,
        // Key declared by @voyantjs/bookings-react/admin (bound above).
        destination: "invoice.detail",
        destinationParams: { id: "invoiceId" },
        ssr: "data-only",
        page: () => import("./pages/invoice-detail.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = runtimeClient(runtime)

          await queryClient.ensureQueryData(getInvoiceQueryOptions(client, id))

          void queryClient.prefetchQuery(getInvoiceLineItemsQueryOptions(client, id))
          void queryClient.prefetchQuery(getInvoicePaymentsQueryOptions(client, id))
          void queryClient.prefetchQuery(getInvoiceCreditNotesQueryOptions(client, id))
          void queryClient.prefetchQuery(getInvoiceNotesQueryOptions(client, id))
        },
        pendingComponent: InvoiceDetailSkeleton,
      },
      {
        id: "finance-invoice-number-series",
        path: `${basePath}/invoice-number-series`,
        title: invoiceNumberSeries,
        ssr: "data-only",
        // `InvoiceNumberSeriesPage` takes an all-optional props bag, which
        // TypeScript's weak-type rule rejects as a route page component
        // despite being safe to mount — hence `adminRoutePageModule`.
        page: () =>
          import("../components/invoice-number-series-page.js").then((module) =>
            adminRoutePageModule(module.InvoiceNumberSeriesPage),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getInvoiceNumberSeriesQueryOptions(runtimeClient(runtime), {
              limit: 100,
              offset: 0,
            }),
          ),
      },
      {
        id: "finance-payments-index",
        path: `${basePath}/payments`,
        title: payments,
        destination: "payment.list",
        ssr: "data-only",
        page: () => import("./pages/payments-index.js"),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(getAllPaymentsQueryOptions(runtimeClient(runtime))),
        pendingComponent: PaymentsPageSkeleton,
      },
      {
        id: "finance-payments-detail",
        path: `${basePath}/payments/$id`,
        title: payments,
        // Key declared by @voyantjs/bookings-react/admin (bound above).
        destination: "payment.detail",
        destinationParams: { id: "paymentId" },
        ssr: "data-only",
        page: () => import("./pages/payment-detail.js"),
        loader: ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          return queryClient.ensureQueryData(getPaymentQueryOptions(runtimeClient(runtime), id))
        },
        pendingComponent: PaymentDetailSkeleton,
      },
      /**
       * Metadata-only on purpose: the operator's supplier-invoices pages
       * carry app-owned wiring (file uploads to the app's `/v1/uploads`,
       * inline supplier creation, cross-domain target search), so they
       * remain host-route-file-bound until the package API can carry that
       * wiring.
       */
      {
        id: "finance-supplier-invoices-index",
        path: `${basePath}/supplier-invoices`,
        title: supplierInvoices,
      },
      /**
       * Metadata-only on purpose: the operator's supplier-invoices pages
       * carry app-owned wiring (file uploads to the app's `/v1/uploads`,
       * inline supplier creation, cross-domain target search), so they
       * remain host-route-file-bound until the package API can carry that
       * wiring.
       */
      {
        id: "finance-supplier-invoices-detail",
        path: `${basePath}/supplier-invoices/$id`,
        title: supplierInvoices,
      },
      {
        id: "finance-profitability",
        path: `${basePath}/profitability`,
        title: profitability,
        ssr: "data-only",
        page: () => import("./pages/profitability.js"),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getDepartureProfitabilityQueryOptions(runtimeClient(runtime)),
          ),
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
