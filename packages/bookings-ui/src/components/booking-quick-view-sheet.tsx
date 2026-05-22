"use client"

import { type BookingRecord, bookingStatusBadgeVariant, useBooking } from "@voyantjs/bookings-react"
import { useOrganization, usePerson } from "@voyantjs/crm-react"
import {
  Badge,
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import { Calendar, ExternalLink, Mail, Phone, Users } from "lucide-react"
import type { ReactNode } from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/index.js"

export interface BookingQuickViewSheetProps {
  bookingId: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Wired to the "View full booking" footer button. Receives the booking
   * so the host can route to its detail page. When omitted, the footer
   * action is suppressed. */
  onViewFull?: (booking: BookingRecord) => void
  /** Optional locale override; defaults to the active i18n locale. */
  locale?: string
}

export function BookingQuickViewSheet({
  bookingId,
  open,
  onOpenChange,
  onViewFull,
  locale,
}: BookingQuickViewSheetProps) {
  const i18n = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage
  const quick = messages.bookingQuickViewSheet
  const resolvedLocale = locale ?? i18n.locale

  const { data, isPending } = useBooking(bookingId ?? undefined, {
    enabled: open && Boolean(bookingId),
  })
  const booking = data?.data ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{booking?.bookingNumber ?? quick.loadingTitle}</span>
            {booking ? (
              <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                {messages.common.bookingStatusLabels[booking.status] ?? booking.status}
              </Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          {isPending && !booking ? (
            <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
          ) : !booking ? (
            <p className="text-sm text-muted-foreground">{detail.notFound}</p>
          ) : (
            <QuickViewBody booking={booking} locale={resolvedLocale} />
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          {onViewFull && booking ? (
            <Button type="button" onClick={() => onViewFull(booking)}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {quick.viewFullAction}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function QuickViewBody({ booking, locale }: { booking: BookingRecord; locale: string }) {
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage
  const quick = messages.bookingQuickViewSheet

  const dateRange = booking.startDate
    ? `${formatDate(booking.startDate, locale, detail.noValue)} - ${formatDate(
        booking.endDate,
        locale,
        detail.noValue,
      )}`
    : detail.tbd

  const sellAmount = formatAmount(
    booking.sellAmountCents,
    booking.sellCurrency,
    locale,
    detail.noValue,
  )

  const notes = visibleInternalNotes(booking.internalNotes)

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <SummaryRow
          icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
          label={detail.summaryDates}
          value={dateRange}
        />
        <SummaryRow
          icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
          label={detail.summaryTravelers}
          value={booking.pax != null ? String(booking.pax) : detail.noValue}
        />
      </div>

      <ContactSection booking={booking} />

      <div className="rounded-md border bg-muted/40 px-3 py-2.5">
        <div className="text-xs font-medium text-muted-foreground">{detail.summarySell}</div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums">{sellAmount}</div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          {detail.internalNotesLabel}
        </div>
        {notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{quick.noInternalNotes}</p>
        )}
      </div>
    </>
  )
}

function ContactSection({ booking }: { booking: BookingRecord }) {
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage
  const quick = messages.bookingQuickViewSheet

  const person = usePerson(booking.personId ?? undefined, {
    enabled: Boolean(booking.personId),
  }).data
  const organization = useOrganization(booking.organizationId ?? undefined, {
    enabled: Boolean(booking.organizationId) && !booking.personId,
  }).data

  const name =
    [booking.contactFirstName, booking.contactLastName].filter(Boolean).join(" ") ||
    (person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "") ||
    organization?.name ||
    ""
  const email = booking.contactEmail ?? person?.email ?? null
  const phone = booking.contactPhone ?? person?.phone ?? null

  if (!name && !email && !phone) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">{detail.billingPayer}</div>
        <p className="text-sm text-muted-foreground">{quick.noContact}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{detail.billingPayer}</div>
      {name ? <div className="text-sm font-medium">{name}</div> : null}
      {email ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">{email}</span>
        </div>
      ) : null}
      {phone ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">{phone}</span>
        </div>
      ) : null}
    </div>
  )
}

function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
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

function formatDate(iso: string | null, locale: string, empty: string): string {
  if (!iso) return empty
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Mirrors booking-detail-page: drop server-relay markers like
 * `__contract_acceptance__:` so operators see only human-readable notes.
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
