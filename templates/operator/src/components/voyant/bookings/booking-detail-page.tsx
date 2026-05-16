"use client"

import { Link, useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBooking,
  useBookingMutation,
} from "@voyantjs/bookings-react"
import { BookingActivityTimeline } from "@voyantjs/bookings-ui/components/booking-activity-timeline"
import { BookingCancellationDialog } from "@voyantjs/bookings-ui/components/booking-cancellation-dialog"
import { BookingDialog } from "@voyantjs/bookings-ui/components/booking-dialog"
import { BookingGroupSection } from "@voyantjs/bookings-ui/components/booking-group-section"
import { BookingGuaranteeList } from "@voyantjs/bookings-ui/components/booking-guarantee-list"
import { BookingItemList } from "@voyantjs/bookings-ui/components/booking-item-list"
import { BookingNotes } from "@voyantjs/bookings-ui/components/booking-notes"
import { BookingPaymentScheduleList } from "@voyantjs/bookings-ui/components/booking-payment-schedule-list"
import { BookingPaymentsSummary } from "@voyantjs/bookings-ui/components/booking-payments-summary"
import { StatusChangeDialog } from "@voyantjs/bookings-ui/components/status-change-dialog"
import { SupplierStatusList } from "@voyantjs/bookings-ui/components/supplier-status-list"
import { TravelerList } from "@voyantjs/bookings-ui/components/traveler-list"
import { CollectPaymentDialog } from "@voyantjs/checkout-ui"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import {
  Ban,
  Calendar,
  ChevronRight,
  CreditCard,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { AdminWidgetSlotRenderer } from "@/components/admin/admin-widget-slot"
import { useAdminMessages } from "@/lib/admin-i18n"
import { visibleInternalNotes } from "@/lib/internal-notes"
import { BookingActionLedgerPanel } from "./booking-action-ledger-panel"
import { BookingCatalogSourceCard } from "./booking-catalog-source-card"
import { BookingDetailSkeleton } from "./booking-detail-skeleton"
import { BookingDocumentsTable } from "./booking-documents-table"
import { BookingInvoicesCard } from "./booking-invoices-card"
import { BookingPaidPaymentSessions } from "./booking-paid-payment-sessions"
import { BookingPaymentPolicyCard } from "./booking-payment-policy-card"
import { BookingPendingPaymentSessions } from "./booking-pending-payment-sessions"
import { BookingPricingSummaryCard } from "./booking-pricing-summary-card"

function formatAmount(
  cents: number | null,
  currency: string,
  locale: string,
  empty: string,
): string {
  if (cents == null) return empty
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatMargin(percent: number | null, empty: string): string {
  if (percent == null) return empty
  return `${percent.toFixed(0)}%`
}

function formatDate(iso: string | null, locale: string, empty: string): string {
  if (!iso) return empty
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getBookingStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["list"],
) {
  switch (status) {
    case "draft":
      return messages.statusDraft
    case "confirmed":
      return messages.statusConfirmed
    case "in_progress":
      return messages.statusInProgress
    case "completed":
      return messages.statusCompleted
    case "cancelled":
      return messages.statusCancelled
    default:
      return status
  }
}

export function BookingDetailPage({ id }: { id: string }) {
  const messages = useAdminMessages()
  const bookingListMessages = messages.bookings.list
  const detailMessages = messages.bookings.detail
  const { resolvedLocale } = useLocale()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const { data: bookingData, isPending } = useBooking(id)
  const { remove } = useBookingMutation()

  if (isPending) {
    return <BookingDetailSkeleton />
  }

  const booking = bookingData?.data
  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/bookings" })}>
          {detailMessages.backToBookings}
        </Button>
      </div>
    )
  }

  const canCancel = ["draft", "on_hold", "confirmed", "in_progress"].includes(booking.status)
  const sellHint = booking.priceOverride?.isManual
    ? `${detailMessages.summaryPriceOverride}: ${booking.priceOverride.reason}`
    : booking.sellCurrency

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/bookings" className="transition-colors hover:text-foreground">
          {detailMessages.breadcrumbBookings}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-normal text-foreground">{booking.bookingNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{booking.bookingNumber}</h1>
          <Badge variant={bookingStatusBadgeVariant[booking.status]}>
            {getBookingStatusLabel(booking.status, bookingListMessages)}
          </Badge>
        </div>
        <ActionMenu>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            {detailMessages.editAction}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw className="h-4 w-4" />
            {detailMessages.changeStatusAction}
          </DropdownMenuItem>
          {canCancel ? (
            <DropdownMenuItem onClick={() => setCancelDialogOpen(true)}>
              <Ban className="h-4 w-4" />
              {detailMessages.cancelBookingAction}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={remove.isPending}
            onClick={async () => {
              if (confirm(detailMessages.deleteConfirm)) {
                await remove.mutateAsync(id)
                void navigate({ to: "/bookings" })
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            {detailMessages.deleteAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>

      <AdminWidgetSlotRenderer slot="booking.details.header" props={{ booking }} />

      {/* Summary */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
          <SummaryStat
            label={detailMessages.summarySell}
            value={formatAmount(
              booking.sellAmountCents,
              booking.sellCurrency,
              resolvedLocale,
              detailMessages.noValue,
            )}
            hint={sellHint}
          />
          <SummaryStat
            label={detailMessages.summaryCostMargin}
            value={formatAmount(
              booking.costAmountCents,
              booking.sellCurrency,
              resolvedLocale,
              detailMessages.noValue,
            )}
            hint={formatMargin(booking.marginPercent, detailMessages.noValue)}
          />
          <SummaryStat
            label={detailMessages.summaryDates}
            value={
              booking.startDate
                ? `${formatDate(booking.startDate, resolvedLocale, detailMessages.noValue)} — ${formatDate(booking.endDate, resolvedLocale, detailMessages.noValue)}`
                : detailMessages.tbd
            }
            icon={<Calendar className="h-3.5 w-3.5" />}
          />
          <SummaryStat
            label={detailMessages.summaryTravelers}
            value={booking.pax != null ? String(booking.pax) : detailMessages.noValue}
            icon={<Users className="h-3.5 w-3.5" />}
          />

          {booking.personId ? (
            <SummaryLink
              label={detailMessages.summaryPerson}
              to="/people/$id"
              params={{ id: booking.personId }}
            />
          ) : null}
          {booking.organizationId ? (
            <SummaryLink
              label={detailMessages.summaryOrganization}
              to="/organizations/$id"
              params={{ id: booking.organizationId }}
            />
          ) : null}
          <SummaryStat
            label={detailMessages.summaryCreated}
            value={formatDate(booking.createdAt, resolvedLocale, detailMessages.noValue)}
          />
          <SummaryStat
            label={detailMessages.summaryUpdated}
            value={formatDate(booking.updatedAt, resolvedLocale, detailMessages.noValue)}
          />
        </CardContent>
      </Card>

      <AdminWidgetSlotRenderer slot="booking.details.after-summary" props={{ booking }} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">{detailMessages.tabOverview}</TabsTrigger>
          <TabsTrigger value="travelers">{detailMessages.tabTravelers}</TabsTrigger>
          <TabsTrigger value="finance">{detailMessages.tabFinance}</TabsTrigger>
          <TabsTrigger value="suppliers">{detailMessages.tabSuppliers}</TabsTrigger>
          <TabsTrigger value="documents">{detailMessages.tabDocuments}</TabsTrigger>
          <TabsTrigger value="activity">{detailMessages.tabActivity}</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
          <BookingCatalogSourceCard bookingId={id} />
          <BookingItemList bookingId={id} />
          <BookingPricingSummaryCard bookingId={id} defaultCurrency={booking.sellCurrency} />
          <BookingGroupSection bookingId={id} />
          {(() => {
            // Strip internal markers (`__contract_acceptance__:`,
            // `__payment_policy_source__:`) before rendering — those
            // are server-side relays, not human-readable notes.
            // Their canonical home is on the contract signature row
            // / schedule history; surfacing them here just confuses
            // operators with raw JSON.
            const visible = visibleInternalNotes(booking.internalNotes)
            return visible ? (
              <Card>
                <CardContent className="py-5">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {detailMessages.internalNotesLabel}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{visible}</p>
                </CardContent>
              </Card>
            ) : null
          })()}
        </TabsContent>

        <TabsContent value="travelers" className="mt-4 flex flex-col gap-6">
          <BookingBillingContextCard booking={booking} />
          <TravelerList bookingId={id} autoReveal />
        </TabsContent>

        <TabsContent value="finance" className="mt-4 flex flex-col gap-6">
          <div className="flex items-center justify-end">
            <Button onClick={() => setCollectPaymentOpen(true)}>Collect payment</Button>
          </div>
          <BookingPendingPaymentSessions bookingId={id} />
          <BookingPaidPaymentSessions bookingId={id} />
          <BookingInvoicesCard bookingId={id} />
          <BookingPaymentsSummary bookingId={id} variant="admin" />
          <BookingPaymentPolicyCard booking={booking} />
          <BookingPaymentScheduleList bookingId={id} />
          <BookingGuaranteeList bookingId={id} />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SupplierStatusList bookingId={id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 flex flex-col gap-4">
          <BookingDocumentsTable bookingId={id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4 flex flex-col gap-6">
          <BookingActivityTimeline bookingId={id} />
          <BookingNotes bookingId={id} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 flex flex-col gap-6">
          <BookingActionLedgerPanel bookingId={id} />
        </TabsContent>
      </Tabs>

      <BookingDialog open={editOpen} onOpenChange={setEditOpen} booking={booking} />

      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        bookingId={id}
        currentStatus={booking.status}
      />

      <BookingCancellationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        booking={booking}
      />

      <CollectPaymentDialog
        open={collectPaymentOpen}
        onOpenChange={setCollectPaymentOpen}
        bookingId={id}
        defaultCurrency={booking.sellCurrency}
        defaultAmountCents={booking.sellAmountCents ?? null}
        defaultPayerLanguage={resolvedLocale}
      />
    </div>
  )
}

function SummaryStat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function BookingBillingContextCard({ booking }: { booking: BookingRecord }) {
  const payerName = [booking.contactFirstName, booking.contactLastName].filter(Boolean).join(" ")
  const address = [
    booking.contactAddressLine1,
    booking.contactCity,
    booking.contactRegion,
    booking.contactPostalCode,
    booking.contactCountry,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Billing contact
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <BillingField label="Payer" value={payerName || "-"} />
        <BillingField
          label="Email"
          value={booking.contactEmail ?? "-"}
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <BillingField
          label="Phone"
          value={booking.contactPhone ?? "-"}
          icon={<Phone className="h-3.5 w-3.5" />}
        />
        <BillingField
          label="Address"
          value={address || "-"}
          icon={<MapPin className="h-3.5 w-3.5" />}
        />
      </CardContent>
    </Card>
  )
}

function BillingField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  )
}

function ActionMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

function SummaryLink({
  label,
  to,
  params,
}: {
  label: string
  to: "/people/$id" | "/organizations/$id"
  params: { id: string }
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Link
        to={to}
        params={params}
        className="truncate font-mono text-xs text-primary hover:underline"
      >
        {params.id}
      </Link>
    </div>
  )
}
