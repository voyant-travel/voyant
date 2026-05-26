"use client"

import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBooking,
  useBookingMutation,
} from "@voyantjs/bookings-react"
import { useOrganization, usePerson } from "@voyantjs/crm-react"
import { useInvoiceMutation } from "@voyantjs/finance-react"
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
  ChevronRight,
  CreditCard,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import { BookingActivityTimeline } from "./booking-activity-timeline.js"
import { BookingBillingDialog } from "./booking-billing-dialog.js"
import { BookingCancellationDialog } from "./booking-cancellation-dialog.js"
import { BookingDialog } from "./booking-dialog.js"
import { BookingGroupSection } from "./booking-group-section.js"
import { BookingGuaranteeList } from "./booking-guarantee-list.js"
import { BookingItemList, type BookingItemResourceKind } from "./booking-item-list.js"
import { BookingNotes } from "./booking-notes.js"
import { BookingPaymentReconciliationBanner } from "./booking-payment-reconciliation-banner.js"
import { BookingPaymentScheduleList } from "./booking-payment-schedule-list.js"
import { BookingPaymentsSummary } from "./booking-payments-summary.js"
import { StatusChangeDialog } from "./status-change-dialog.js"
import { SupplierStatusList } from "./supplier-status-list.js"
import { TravelerList } from "./traveler-list.js"

/**
 * Optional extra tab. When provided, the canonical layout renders a
 * trigger and a content panel. Modeled after PersonDetailPage's
 * commercial-tab slot shape. The trigger label falls back to the i18n
 * default (`messages.bookingDetailPage.tabInvoices` etc.).
 */
export interface BookingDetailTabSlot {
  label?: string
  /** Receives the loaded booking so the slot can use sell amount, ids, etc. */
  content: ReactNode | ((booking: BookingRecord) => ReactNode)
}

export interface BookingDetailPageSlots {
  /** Rendered between the title row and the summary card. */
  header?: (booking: BookingRecord) => ReactNode
  /** Rendered between the summary card and the tabs. */
  afterSummary?: (booking: BookingRecord) => ReactNode
  overviewStart?: (booking: BookingRecord) => ReactNode
  overviewEnd?: (booking: BookingRecord) => ReactNode
  travelersStart?: (booking: BookingRecord) => ReactNode
  financeStart?: (booking: BookingRecord) => ReactNode
  financeEnd?: (booking: BookingRecord) => ReactNode
  documents?: (booking: BookingRecord) => ReactNode
  activityEnd?: (booking: BookingRecord) => ReactNode
  /** Mounts a dedicated `Invoices` tab between Payments and Suppliers. */
  invoicesTab?: BookingDetailTabSlot
  /** Mounts a dedicated `Ledger` tab at the far right. */
  ledgerTab?: BookingDetailTabSlot
}

export interface BookingDetailPageProps {
  id: string
  className?: string
  locale?: string
  /** When true, the inline `Bookings > #` breadcrumb is suppressed
   * (use when the host shell already renders breadcrumbs). */
  hideBreadcrumb?: boolean
  onBack?: () => void
  /** Wired to a primary `Generate payment link` button on the Payments tab. */
  onCollectPayment?: (booking: BookingRecord) => void
  /** Wired to a secondary `Record payment` button on the Payments tab. */
  onRecordPayment?: (booking: BookingRecord) => void
  /**
   * Amount the customer has paid so far against this booking, in cents
   * of `booking.sellCurrency`. When provided, a `Paid` stat is shown
   * next to `Total`. Resolution (invoices vs. raw payments) is left to
   * the host template — `bookings-ui` doesn't fetch finance data.
   */
  paidAmountCents?: number | null
  /**
   * Open a linked resource referenced by a booking item (product or
   * availability slot) in the host app. When omitted, the item-snapshot
   * sheet renders the names as plain text.
   */
  onItemResourceOpen?: (kind: BookingItemResourceKind, id: string) => void
  /** Open the linked CRM person's detail page (used by the Payer card). */
  onPersonOpen?: (personId: string) => void
  /** Open the linked CRM organization's detail page (used by the Payer card). */
  onOrganizationOpen?: (organizationId: string) => void
  slots?: BookingDetailPageSlots
}

export function BookingDetailPage({
  id,
  className,
  locale,
  hideBreadcrumb,
  onBack,
  onCollectPayment,
  onRecordPayment,
  paidAmountCents,
  onItemResourceOpen,
  onPersonOpen,
  onOrganizationOpen,
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
  const { convertToInvoice } = useInvoiceMutation()
  const headerPersonId = bookingData?.data?.personId ?? null
  const headerOrganizationId = bookingData?.data?.organizationId ?? null
  const headerPerson = usePerson(headerPersonId ?? undefined, {
    enabled: Boolean(headerPersonId),
  }).data
  const headerOrganization = useOrganization(headerOrganizationId ?? undefined, {
    enabled: Boolean(headerOrganizationId) && !headerPersonId,
  }).data

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
  const sellHint = booking.priceOverride?.isManual
    ? `${detailMessages.summaryPriceOverride}: ${booking.priceOverride.reason}`
    : undefined

  const billingPersonName =
    [booking.contactFirstName, booking.contactLastName].filter(Boolean).join(" ") ||
    (headerPerson
      ? [headerPerson.firstName, headerPerson.lastName].filter(Boolean).join(" ")
      : "") ||
    headerOrganization?.name ||
    ""
  const headerDateRange = booking.startDate
    ? `${formatDate(booking.startDate, resolvedLocale, detailMessages.noValue)} - ${formatDate(
        booking.endDate,
        resolvedLocale,
        detailMessages.noValue,
      )}`
    : null
  const headerPax = booking.pax != null ? `${booking.pax} PAX` : null
  const headerSubtitle = [billingPersonName || null, headerDateRange, headerPax]
    .filter(Boolean)
    .join(" / ")

  return (
    <div data-slot="booking-detail-page" className={cn("flex flex-col gap-6 p-6", className)}>
      {hideBreadcrumb ? null : (
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
      )}

      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{booking.bookingNumber}</h1>
            <Badge variant={bookingStatusBadgeVariant[booking.status]}>
              {getBookingStatusLabel(booking.status, messages.common.bookingStatusLabels)}
            </Badge>
          </div>
          {headerSubtitle ? (
            <div className="text-sm text-muted-foreground">{headerSubtitle}</div>
          ) : null}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={detailMessages.summaryTotal} hint={sellHint}>
          {formatAmount(
            booking.sellAmountCents,
            booking.sellCurrency,
            resolvedLocale,
            detailMessages.noValue,
          )}
        </StatCard>
        <StatCard
          label={detailMessages.summaryPaid}
          badge={
            paidAmountCents != null && booking.sellAmountCents
              ? renderPercentBadge(
                  Math.round((paidAmountCents / booking.sellAmountCents) * 100),
                  paidBadgeClass,
                )
              : null
          }
        >
          {paidAmountCents != null
            ? formatAmount(
                paidAmountCents,
                booking.sellCurrency,
                resolvedLocale,
                detailMessages.noValue,
              )
            : detailMessages.noValue}
        </StatCard>
        <StatCard
          label={detailMessages.summaryCostMargin}
          badge={
            booking.marginPercent != null
              ? renderPercentBadge(booking.marginPercent, marginBadgeClass)
              : null
          }
        >
          {formatAmount(
            booking.costAmountCents,
            booking.sellCurrency,
            resolvedLocale,
            detailMessages.noValue,
          )}
        </StatCard>
        <StatCard label={detailMessages.summaryCreated}>
          {formatDate(booking.createdAt, resolvedLocale, detailMessages.noValue)}
        </StatCard>
      </div>

      {slots?.afterSummary?.(booking)}

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">{detailMessages.tabOverview}</TabsTrigger>
          <TabsTrigger value="travelers">{detailMessages.tabTravelers}</TabsTrigger>
          <TabsTrigger value="finance">{detailMessages.tabFinance}</TabsTrigger>
          {slots?.invoicesTab ? (
            <TabsTrigger value="invoices">
              {slots.invoicesTab.label ?? detailMessages.tabInvoices}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="suppliers">{detailMessages.tabSuppliers}</TabsTrigger>
          <TabsTrigger value="documents">{detailMessages.tabDocuments}</TabsTrigger>
          <TabsTrigger value="activity">{detailMessages.tabActivity}</TabsTrigger>
          {slots?.ledgerTab ? (
            <TabsTrigger value="ledger">
              {slots.ledgerTab.label ?? detailMessages.tabLedger}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="meta">{detailMessages.tabMeta}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
          {slots?.overviewStart?.(booking)}
          <BookingItemList bookingId={id} onResourceOpen={onItemResourceOpen} />
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
          <BookingBillingContextCard
            booking={booking}
            onPersonOpen={onPersonOpen}
            onOrganizationOpen={onOrganizationOpen}
          />
          <TravelerList bookingId={id} autoReveal />
        </TabsContent>

        <TabsContent value="finance" className="mt-4 flex flex-col gap-6">
          {onCollectPayment || onRecordPayment ? (
            <div className="flex items-center justify-end gap-2">
              {onRecordPayment ? (
                <Button variant="outline" onClick={() => onRecordPayment(booking)}>
                  {detailMessages.recordPaymentAction}
                </Button>
              ) : null}
              {onCollectPayment ? (
                <Button onClick={() => onCollectPayment(booking)}>
                  {detailMessages.collectPaymentAction}
                </Button>
              ) : null}
            </div>
          ) : null}
          {slots?.financeStart?.(booking)}
          <BookingPaymentReconciliationBanner bookingId={id} />
          <BookingPaymentsSummary
            bookingId={id}
            variant="admin"
            onConvertProforma={(row) => convertToInvoice.mutateAsync({ id: row.invoiceId })}
          />
          <BookingPaymentScheduleList bookingId={id} />
          <BookingGuaranteeList bookingId={id} />
          {slots?.financeEnd?.(booking)}
        </TabsContent>

        {slots?.invoicesTab ? (
          <TabsContent value="invoices" className="mt-4 flex flex-col gap-6">
            {renderTabSlot(slots.invoicesTab.content, booking)}
          </TabsContent>
        ) : null}

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

        {slots?.ledgerTab ? (
          <TabsContent value="ledger" className="mt-4 flex flex-col gap-6">
            {renderTabSlot(slots.ledgerTab.content, booking)}
          </TabsContent>
        ) : null}

        <TabsContent value="meta" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
              <SummaryStat
                label={detailMessages.summaryUpdated}
                value={formatDate(booking.updatedAt, resolvedLocale, detailMessages.noValue)}
              />
            </CardContent>
          </Card>
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

function renderTabSlot(
  content: BookingDetailTabSlot["content"],
  booking: BookingRecord,
): ReactNode {
  return typeof content === "function" ? content(booking) : content
}

/**
 * Billing/contact card for the Travelers tab. Snapshot fields on the
 * booking row are the source of truth (they capture contact info at
 * the time of booking). When they're empty — typically for bookings
 * created via flows that don't snapshot — fall back to the linked CRM
 * person / organization so the operator still sees who they're
 * billing.
 */
export function BookingBillingContextCard({
  booking,
  onPersonOpen,
  onOrganizationOpen,
}: {
  booking: BookingRecord
  /** Open the linked CRM person's detail page. */
  onPersonOpen?: (personId: string) => void
  /** Open the linked CRM organization's detail page. */
  onOrganizationOpen?: (organizationId: string) => void
}) {
  const messages = useBookingsUiMessagesOrDefault().bookingDetailPage
  const [editOpen, setEditOpen] = useState(false)
  const person = usePerson(booking.personId ?? undefined, {
    enabled: Boolean(booking.personId),
  }).data
  const organization = useOrganization(booking.organizationId ?? undefined, {
    enabled: Boolean(booking.organizationId) && !booking.personId,
  }).data

  const payerName =
    [booking.contactFirstName, booking.contactLastName].filter(Boolean).join(" ") ||
    (person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "") ||
    organization?.name ||
    ""
  const email = booking.contactEmail ?? person?.email ?? null
  const phone = booking.contactPhone ?? person?.phone ?? null
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
    <div data-slot="booking-billing-context" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {messages.billingPayer}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {messages.editAction}
        </Button>
      </div>
      <div className="flex flex-col gap-4 rounded-md border p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <BillingField
            label={messages.billingPayer}
            value={
              payerName ? (
                booking.personId && onPersonOpen ? (
                  <button
                    type="button"
                    onClick={() => onPersonOpen(booking.personId as string)}
                    className="text-left text-primary hover:underline"
                  >
                    {payerName}
                  </button>
                ) : booking.organizationId && !booking.personId && onOrganizationOpen ? (
                  <button
                    type="button"
                    onClick={() => onOrganizationOpen(booking.organizationId as string)}
                    className="text-left text-primary hover:underline"
                  >
                    {payerName}
                  </button>
                ) : (
                  payerName
                )
              ) : (
                messages.noValue
              )
            }
          />
          <BillingField
            label={messages.billingEmail}
            value={email ?? messages.noValue}
            icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <BillingField
            label={messages.billingPhone}
            value={phone ?? messages.noValue}
            icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        </div>
        <BillingField
          label={messages.billingAddress}
          value={address || messages.noValue}
          icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </div>
      <BookingBillingDialog open={editOpen} onOpenChange={setEditOpen} booking={booking} />
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

function StatCard({
  label,
  children,
  hint,
  badge,
}: {
  label: string
  children: ReactNode
  hint?: string
  badge?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xl font-semibold tabular-nums leading-none">{children}</div>
          {badge}
        </div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

/**
 * Traffic-light badge for a percentage value. Color thresholds are
 * passed in by the caller (Paid uses 0 → red, 0..100 → yellow, 100 →
 * green; Margin uses <0 → red, 0..10 → yellow, >10 → green).
 */
function renderPercentBadge(percent: number, classFor: (percent: number) => string): ReactNode {
  return (
    <Badge variant="outline" className={cn("border-transparent", classFor(percent))}>
      {percent}%
    </Badge>
  )
}

function paidBadgeClass(percent: number): string {
  if (percent <= 0) return "bg-red-500/10 text-red-600 dark:text-red-400"
  if (percent >= 100) return "bg-green-500/10 text-green-600 dark:text-green-400"
  return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
}

function marginBadgeClass(percent: number): string {
  if (percent < 0) return "bg-red-500/10 text-red-600 dark:text-red-400"
  if (percent > 10) return "bg-green-500/10 text-green-600 dark:text-green-400"
  return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
}

function BillingField({
  label,
  value,
  icon,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
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
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
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
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(cents / 100)
  return `${formatted} ${currency}`
}

function formatDate(iso: string | null, locale: string, empty: string): string {
  if (!iso) return empty
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Strip internal markers (`__contract_acceptance__:`,
 * `__payment_policy_source__:`) before rendering — those are
 * server-side relays, not human-readable notes. Their canonical home
 * is on the contract signature row / schedule history; surfacing them
 * here just confuses operators with raw JSON.
 */
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
