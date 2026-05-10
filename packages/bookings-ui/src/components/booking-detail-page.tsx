"use client"

import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBooking,
  useBookingMutation,
} from "@voyantjs/bookings-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import {
  Ban,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import { BookingActivityTimeline } from "./booking-activity-timeline.js"
import { BookingCancellationDialog } from "./booking-cancellation-dialog.js"
import { BookingDialog } from "./booking-dialog.js"
import { BookingGroupSection } from "./booking-group-section.js"
import { BookingGuaranteeList } from "./booking-guarantee-list.js"
import { BookingItemList } from "./booking-item-list.js"
import { BookingNotes } from "./booking-notes.js"
import { BookingPaymentScheduleList } from "./booking-payment-schedule-list.js"
import { BookingPaymentsSummary } from "./booking-payments-summary.js"
import { StatusChangeDialog } from "./status-change-dialog.js"
import { SupplierStatusList } from "./supplier-status-list.js"
import { TravelerList } from "./traveler-list.js"

export interface BookingDetailPageSlots {
  header?: (booking: BookingRecord) => ReactNode
  afterSummary?: (booking: BookingRecord) => ReactNode
  overviewStart?: (booking: BookingRecord) => ReactNode
  overviewEnd?: (booking: BookingRecord) => ReactNode
  travelersStart?: (booking: BookingRecord) => ReactNode
  financeStart?: (booking: BookingRecord) => ReactNode
  financeEnd?: (booking: BookingRecord) => ReactNode
  documents?: (booking: BookingRecord) => ReactNode
  activityEnd?: (booking: BookingRecord) => ReactNode
}

export interface BookingDetailPageProps {
  id: string
  className?: string
  locale?: string
  onBack?: () => void
  onPersonOpen?: (personId: string) => void
  onOrganizationOpen?: (organizationId: string) => void
  onCollectPayment?: (booking: BookingRecord) => void
  slots?: BookingDetailPageSlots
}

export function BookingDetailPage({
  id,
  className,
  locale,
  onBack,
  onPersonOpen,
  onOrganizationOpen,
  onCollectPayment,
  slots,
}: BookingDetailPageProps) {
  const i18n = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const detailMessages = messages.bookingDetailPage
  const resolvedLocale = locale ?? i18n.locale
  const [editOpen, setEditOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const { data: bookingData, isPending } = useBooking(id)
  const { remove } = useBookingMutation()

  if (isPending) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
      </div>
    )
  }

  const booking = bookingData?.data
  if (!booking) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            {detailMessages.backToBookings}
          </Button>
        ) : null}
      </div>
    )
  }

  const canCancel = ["draft", "on_hold", "confirmed", "in_progress"].includes(booking.status)

  return (
    <div data-slot="booking-detail-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="transition-colors hover:text-foreground"
          >
            {detailMessages.breadcrumbBookings}
          </button>
        ) : (
          <span>{detailMessages.breadcrumbBookings}</span>
        )}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-normal text-foreground">{booking.bookingNumber}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{booking.bookingNumber}</h1>
          <Badge variant={bookingStatusBadgeVariant[booking.status]}>
            {getBookingStatusLabel(booking.status, messages.common.bookingStatusLabels)}
          </Badge>
        </div>
        <ActionMenu>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {detailMessages.editAction}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {detailMessages.changeStatusAction}
          </DropdownMenuItem>
          {canCancel ? (
            <DropdownMenuItem onClick={() => setCancelDialogOpen(true)}>
              <Ban className="h-4 w-4" aria-hidden="true" />
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
                onBack?.()
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {detailMessages.deleteAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>

      {slots?.header?.(booking)}

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
            hint={booking.sellCurrency}
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
                ? `${formatDate(booking.startDate, resolvedLocale, detailMessages.noValue)} - ${formatDate(
                    booking.endDate,
                    resolvedLocale,
                    detailMessages.noValue,
                  )}`
                : detailMessages.tbd
            }
            icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <SummaryStat
            label={detailMessages.summaryTravelers}
            value={booking.pax != null ? String(booking.pax) : detailMessages.noValue}
            icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
          />

          {booking.personId ? (
            <SummaryLink
              label={detailMessages.summaryPerson}
              id={booking.personId}
              onOpen={onPersonOpen}
            />
          ) : null}
          {booking.organizationId ? (
            <SummaryLink
              label={detailMessages.summaryOrganization}
              id={booking.organizationId}
              onOpen={onOrganizationOpen}
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

      {slots?.afterSummary?.(booking)}

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">{detailMessages.tabOverview}</TabsTrigger>
          <TabsTrigger value="travelers">{detailMessages.tabTravelers}</TabsTrigger>
          <TabsTrigger value="finance">{detailMessages.tabFinance}</TabsTrigger>
          <TabsTrigger value="suppliers">{detailMessages.tabSuppliers}</TabsTrigger>
          <TabsTrigger value="documents">{detailMessages.tabDocuments}</TabsTrigger>
          <TabsTrigger value="activity">{detailMessages.tabActivity}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
          {slots?.overviewStart?.(booking)}
          <BookingItemList bookingId={id} />
          <BookingGroupSection bookingId={id} />
          {visibleInternalNotes(booking.internalNotes) ? (
            <Card>
              <CardContent className="py-5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {detailMessages.internalNotesLabel}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {visibleInternalNotes(booking.internalNotes)}
                </p>
              </CardContent>
            </Card>
          ) : null}
          {slots?.overviewEnd?.(booking)}
        </TabsContent>

        <TabsContent value="travelers" className="mt-4 flex flex-col gap-6">
          {slots?.travelersStart?.(booking)}
          <BookingBillingContextCard booking={booking} />
          <TravelerList bookingId={id} autoReveal />
        </TabsContent>

        <TabsContent value="finance" className="mt-4 flex flex-col gap-6">
          {onCollectPayment ? (
            <div className="flex items-center justify-end">
              <Button onClick={() => onCollectPayment(booking)}>
                {detailMessages.collectPaymentAction}
              </Button>
            </div>
          ) : null}
          {slots?.financeStart?.(booking)}
          <BookingPaymentsSummary bookingId={id} variant="admin" />
          <BookingPaymentScheduleList bookingId={id} />
          <BookingGuaranteeList bookingId={id} />
          {slots?.financeEnd?.(booking)}
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SupplierStatusList bookingId={id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 flex flex-col gap-4">
          {slots?.documents ? (
            slots.documents(booking)
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {detailMessages.documentsSlotEmpty}
            </p>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 flex flex-col gap-6">
          <BookingActivityTimeline bookingId={id} />
          <BookingNotes bookingId={id} />
          {slots?.activityEnd?.(booking)}
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
    </div>
  )
}

export function BookingBillingContextCard({ booking }: { booking: BookingRecord }) {
  const messages = useBookingsUiMessagesOrDefault().bookingDetailPage
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
      <CardContent className="grid gap-4 py-5 md:grid-cols-4">
        <BillingField label={messages.billingPayer} value={payerName || messages.noValue} />
        <BillingField
          label={messages.billingEmail}
          value={booking.contactEmail ?? messages.noValue}
          icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
        />
        <BillingField
          label={messages.billingPhone}
          value={booking.contactPhone ?? messages.noValue}
          icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
        />
        <BillingField
          label={messages.billingAddress}
          value={address || messages.noValue}
          icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </CardContent>
    </Card>
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
  icon?: ReactNode
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

function BillingField({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
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
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

function SummaryLink({
  label,
  id,
  onOpen,
}: {
  label: string
  id: string
  onOpen?: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(id)}
          className="truncate text-left font-mono text-primary text-xs hover:underline"
        >
          {id}
        </button>
      ) : (
        <span className="truncate font-mono text-xs">{id}</span>
      )}
    </div>
  )
}

function getBookingStatusLabel(status: string, labels: Record<string, string>) {
  return labels[status] ?? status
}

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

function visibleInternalNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const visible = notes
    .split("\n")
    .filter((line) => !/^__[a-z0-9_]+__:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return visible.length > 0 ? visible : null
}
