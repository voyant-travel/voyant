"use client"

import {
  AdminWidgetSlotRenderer,
  resolveAdminWidgets,
  useAdminBreadcrumbs,
  useAdminExtensions,
  useAdminHref,
  useAdminNavigate,
  useLocale,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
import { type BookingRecord, useBooking } from "@voyantjs/bookings-react"
import { useInvoices, usePaymentMutation } from "@voyantjs/finance-react"
import { Sheet, SheetContent } from "@voyantjs/ui/components/sheet"
import { type ReactNode, useState } from "react"

import {
  BookingDetailPage,
  type BookingDetailPageSlots,
  type BookingDetailTabValue,
} from "../components/booking-detail-page.js"
import type { BookingPaymentsSummaryRow } from "../components/booking-payments-summary.js"
import { BookingInvoiceSheet } from "./booking-invoice-sheet.js"

/**
 * Widget slot rendered as the booking detail page's Invoices tab
 * (packaged-admin RFC §4.7 cycle resolution): `@voyantjs/finance-ui` depends
 * on this package, so the host cannot import the finance-owned invoices card
 * directly — instead finance's admin extension contributes a widget targeting
 * this slot and the host mounts the tab whenever a contribution exists.
 * Widgets receive {@link BookingDetailHostSlotContext} as props.
 */
export const bookingDetailInvoicesTabSlot = "booking.details.invoices-tab"

/**
 * Render context handed to the host's app-supplied slots AND to widget
 * contributions targeting {@link bookingDetailInvoicesTabSlot}. Carries the
 * booking plus the host-computed payment aggregates and the invoice-sheet
 * opener so contributed cards can participate without re-deriving them.
 */
export interface BookingDetailHostSlotContext {
  booking: BookingRecord
  /** Customer payments summed across non-credit-note, non-draft invoices. */
  paidAmountCents: number | null
  /**
   * Localized "Booking is fully paid" reason when nothing is left to pay,
   * else `null`. The host already uses it for the Record payment / Add
   * schedule buttons; payment-link slots reuse it for their own gating.
   */
  fullyPaidReason: string | null
  /** Open an invoice in the host's side sheet (stays on the booking page). */
  openInvoiceSheet: (invoiceId: string) => void
}

export type BookingDetailHostSlot = (context: BookingDetailHostSlotContext) => ReactNode

/**
 * App-supplied extension points. These exist for booking-detail content
 * whose data access has no package equivalent yet (admin payment-session
 * list/complete/cancel, payment-schedule regenerate, contract generation,
 * booking action-ledger) — the operator keeps those cards and injects them
 * here; everything package-clean is owned by the host.
 */
export interface BookingDetailHostSlots {
  /** Top of the Finance tab (e.g. pending payment-link sessions). */
  financeStart?: BookingDetailHostSlot
  /** Bottom of the Finance tab (e.g. the payment-policy override card). */
  financeEnd?: BookingDetailHostSlot
  /** Mounts a dedicated Invoices tab between Payments and Suppliers. */
  invoicesTab?: { label?: string; content: BookingDetailHostSlot }
  /** Replaces the Documents tab content. */
  documents?: BookingDetailHostSlot
  /** Extra events merged into the Activity-tab timeline. */
  activityExtraEvents?: BookingDetailPageSlots["activityExtraEvents"]
  /** Rendered below the activity timeline events — typically a pager. */
  activityTimelineFooter?: ReactNode
}

export interface BookingDetailHostProps {
  id: string
  /** Controlled tab value; the route file mirrors it into the URL. */
  activeTab?: BookingDetailTabValue
  onTabChange?: (tab: BookingDetailTabValue) => void
  /**
   * Opens the app's record-payment flow (a dialog owned by the host app —
   * the payment dialogs live app-side because `@voyantjs/finance-ui`
   * depends on this package, so importing it here would be a cycle).
   */
  onRecordPayment?: () => void
  /** Opens the app's record-payment flow pre-filled with the row. */
  onEditPayment?: (row: BookingPaymentsSummaryRow) => void
  slots?: BookingDetailHostSlots
}

/**
 * Packaged admin host for the canonical `BookingDetailPage` (packaged-admin
 * RFC Phase 3). Owns everything package-clean:
 *
 *   - Cross-route links resolve through semantic destinations (RFC §4.7):
 *     `booking.list`, `person.detail`, `organization.detail`,
 *     `product.detail`, `availabilitySlot.detail`, `payment.detail`,
 *     `invoice.detail` — no host route tree import.
 *   - Admin chrome breadcrumbs (`useAdminBreadcrumbs`).
 *   - Admin widget extension points: the `booking.details.header` and
 *     `booking.details.after-summary` slots render through the shared
 *     `AdminWidgetSlotRenderer`, which reads the workspace shell's
 *     `AdminExtensionsProvider` context.
 *   - Paid-amount aggregation across the booking's invoices and the
 *     derived fully-paid disabled reasons.
 *   - Payment row delete (finance-react mutation) and the in-place
 *     invoice sheet ({@link BookingInvoiceSheet}).
 *
 * App-local cards without package-level data access stay injectable via
 * {@link BookingDetailHostSlots}.
 */
export function BookingDetailHost({
  id,
  activeTab,
  onTabChange,
  onRecordPayment,
  onEditPayment,
  slots,
}: BookingDetailHostProps) {
  const detailMessages = useOperatorAdminMessages().bookings.detail
  const { resolvedLocale } = useLocale()
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  // Finance (or any extension that may not import this package) contributes
  // the Invoices-tab content as widget contributions; the tab mounts whenever
  // an app slot or at least one widget targets it.
  const adminExtensions = useAdminExtensions()
  const hasInvoicesTabWidgets =
    resolveAdminWidgets({ slot: bookingDetailInvoicesTabSlot, extensions: adminExtensions })
      .length > 0
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null)
  const { remove: removePayment } = usePaymentMutation()
  // Mirror the booking fetch so the admin chrome can render breadcrumbs
  // without prop-drilling through the canonical page. TanStack Query
  // dedupes by key, so this doesn't issue a second network request.
  const { data: bookingData } = useBooking(id)
  const booking = bookingData?.data
  // Sum customer payments across this booking's non-credit-note,
  // non-draft invoices.
  const { data: invoicesData } = useInvoices({ bookingId: id, limit: 20 })
  const paidAmountCents = invoicesData?.data
    ? invoicesData.data
        .filter((inv) => {
          const type = (inv as { invoiceType?: string }).invoiceType ?? "invoice"
          return type !== "credit_note" && inv.status !== "draft"
        })
        .reduce((sum, inv) => sum + (inv.paidCents ?? 0), 0)
    : null
  const fullyPaidReason =
    booking &&
    booking.sellAmountCents != null &&
    paidAmountCents != null &&
    paidAmountCents >= booking.sellAmountCents
      ? detailMessages.generateLinkFullyPaid
      : null

  const bookingsHref = resolveHref("booking.list", {})
  useAdminBreadcrumbs(
    booking
      ? [
          { label: detailMessages.breadcrumbBookings, href: bookingsHref },
          { label: booking.bookingNumber },
        ]
      : [{ label: detailMessages.breadcrumbBookings, href: bookingsHref }],
  )

  const slotContext = (b: BookingRecord): BookingDetailHostSlotContext => ({
    booking: b,
    paidAmountCents,
    fullyPaidReason,
    openInvoiceSheet: setViewingInvoiceId,
  })

  return (
    <>
      <BookingDetailPage
        id={id}
        locale={resolvedLocale}
        hideBreadcrumb
        activeTab={activeTab}
        onTabChange={onTabChange}
        onBack={() => navigateTo("booking.list", {})}
        onPersonOpen={(personId) => navigateTo("person.detail", { personId })}
        onOrganizationOpen={(organizationId) =>
          navigateTo("organization.detail", { organizationId })
        }
        onRecordPayment={onRecordPayment ? () => onRecordPayment() : undefined}
        recordPaymentDisabledReason={fullyPaidReason}
        addScheduleDisabledReason={fullyPaidReason}
        paidAmountCents={paidAmountCents}
        onItemResourceOpen={(kind, resourceId) => {
          if (kind === "product") {
            navigateTo("product.detail", { productId: resourceId })
            return
          }
          if (kind === "availabilitySlot") {
            navigateTo("availabilitySlot.detail", { slotId: resourceId })
          }
        }}
        onInvoiceOpen={(invoiceId) => setViewingInvoiceId(invoiceId)}
        onViewPayment={(row) => navigateTo("payment.detail", { paymentId: row.id })}
        onEditPayment={onEditPayment}
        onDeletePayment={async (row) => {
          await removePayment.mutateAsync(row.id)
        }}
        slots={{
          header: (b) => (
            <AdminWidgetSlotRenderer slot="booking.details.header" props={{ booking: b }} />
          ),
          afterSummary: (b) => (
            <AdminWidgetSlotRenderer slot="booking.details.after-summary" props={{ booking: b }} />
          ),
          financeStart: slots?.financeStart
            ? (b) => slots.financeStart?.(slotContext(b))
            : undefined,
          financeEnd: slots?.financeEnd ? (b) => slots.financeEnd?.(slotContext(b)) : undefined,
          invoicesTab:
            slots?.invoicesTab || hasInvoicesTabWidgets
              ? {
                  label: slots?.invoicesTab?.label,
                  content: (b: BookingRecord) => (
                    <>
                      {slots?.invoicesTab?.content(slotContext(b))}
                      <AdminWidgetSlotRenderer
                        slot={bookingDetailInvoicesTabSlot}
                        props={{ ...slotContext(b) }}
                      />
                    </>
                  ),
                }
              : undefined,
          documents: slots?.documents ? (b) => slots.documents?.(slotContext(b)) : undefined,
          activityExtraEvents: slots?.activityExtraEvents,
          activityTimelineFooter: slots?.activityTimelineFooter,
        }}
      />

      <Sheet
        open={Boolean(viewingInvoiceId)}
        onOpenChange={(open) => {
          if (!open) setViewingInvoiceId(null)
        }}
      >
        <SheetContent side="right" className="w-full! max-w-5xl!">
          {viewingInvoiceId ? (
            <BookingInvoiceSheet
              invoiceId={viewingInvoiceId}
              onOpenInvoice={(invoiceId) => {
                setViewingInvoiceId(null)
                navigateTo("invoice.detail", { invoiceId })
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
