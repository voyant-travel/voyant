"use client"

import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBooking,
  useTravelers,
} from "@voyantjs/bookings-react"
import { useOrganization, usePerson } from "@voyantjs/crm-react"
import {
  useAdminBookingPayments,
  useBookingPaymentSchedules,
  useInvoices,
} from "@voyantjs/finance-react"
import { useLegalContracts } from "@voyantjs/legal-react"
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
import { ArrowRight, Calendar, CreditCard, FileText, Phone, ScrollText, Users } from "lucide-react"
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
        <SheetHeader className="border-b">
          {booking ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="font-mono text-sm">{booking.bookingNumber}</SheetTitle>
                <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                  {messages.common.bookingStatusLabels[booking.status] ?? booking.status}
                </Badge>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatAmount(
                  booking.sellAmountCents,
                  booking.sellCurrency,
                  resolvedLocale,
                  detail.noValue,
                )}
              </div>
            </>
          ) : (
            <SheetTitle>{quick.loadingTitle}</SheetTitle>
          )}
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
        {onViewFull && booking ? (
          <SheetFooter>
            <Button type="button" className="w-full" onClick={() => onViewFull(booking)}>
              {quick.viewFullAction}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function QuickViewBody({ booking, locale }: { booking: BookingRecord; locale: string }) {
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage

  const dateRange = booking.startDate
    ? booking.endDate && booking.endDate !== booking.startDate
      ? `${formatDate(booking.startDate, locale, detail.noValue)} - ${formatDate(
          booking.endDate,
          locale,
          detail.noValue,
        )}`
      : formatDate(booking.startDate, locale, detail.noValue)
    : detail.tbd

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>{dateRange}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>
            {booking.pax != null
              ? `${booking.pax} ${messages.bookingQuickViewSheet.paxSuffix}`
              : detail.noValue}
          </span>
        </div>
      </div>

      <ContactSection booking={booking} />

      <TravelersSection bookingId={booking.id} expectedPax={booking.pax} />

      <PaymentsSection booking={booking} locale={locale} />

      <InvoicesSection booking={booking} />

      <PaymentScheduleSection booking={booking} locale={locale} />

      <ContractsSection bookingId={booking.id} />
    </div>
  )
}

function ContactSection({ booking }: { booking: BookingRecord }) {
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
  const phone = booking.contactPhone ?? person?.phone ?? null

  if (!name && !phone) return null

  return (
    <div className="flex flex-col gap-1.5">
      {name ? <div className="text-sm font-medium">{name}</div> : null}
      {phone ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">{phone}</span>
        </div>
      ) : null}
    </div>
  )
}

function TravelersSection({
  bookingId,
  expectedPax,
}: {
  bookingId: string
  expectedPax: number | null
}) {
  const messages = useBookingsUiMessagesOrDefault()
  const quick = messages.bookingQuickViewSheet
  const { data } = useTravelers(bookingId)
  const travelers = data?.data ?? []

  const counter =
    expectedPax != null ? `${travelers.length}/${expectedPax}` : String(travelers.length)

  return (
    <Section
      icon={<Users className="h-3.5 w-3.5" />}
      label={quick.sectionTravelers}
      count={counter}
    >
      {travelers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{quick.travelersEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {travelers.map((traveler) => {
            const name = [traveler.firstName, traveler.lastName].filter(Boolean).join(" ").trim()
            const category = traveler.travelerCategory ?? null
            return (
              <li
                key={traveler.id}
                className="flex items-center justify-between gap-3 py-1 text-sm"
              >
                <span className="truncate">{name || quick.travelerUnnamed}</span>
                {category ? (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {category}
                  </Badge>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function PaymentsSection({ booking, locale }: { booking: BookingRecord; locale: string }) {
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage
  const quick = messages.bookingQuickViewSheet
  const { data } = useAdminBookingPayments(booking.id)
  const payments = data?.data?.payments ?? []

  const paidCents = payments
    .filter((payment) => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amountCents, 0)
  const totalCents = booking.sellAmountCents ?? 0
  const remainingCents = Math.max(0, totalCents - paidCents)

  return (
    <Section
      icon={<CreditCard className="h-3.5 w-3.5" />}
      label={quick.sectionPayments}
      count={String(payments.length)}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{quick.paymentsPaid}</span>
        <span className="font-medium tabular-nums">
          {formatAmount(paidCents, booking.sellCurrency, locale, detail.noValue)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{quick.paymentsRemaining}</span>
        <span className="font-medium tabular-nums">
          {formatAmount(remainingCents, booking.sellCurrency, locale, detail.noValue)}
        </span>
      </div>
    </Section>
  )
}

function InvoicesSection({ booking }: { booking: BookingRecord }) {
  const messages = useBookingsUiMessagesOrDefault()
  const quick = messages.bookingQuickViewSheet
  const { data } = useInvoices({ bookingId: booking.id, limit: 20 })
  const invoices = data?.data ?? []

  return (
    <Section
      icon={<FileText className="h-3.5 w-3.5" />}
      label={quick.sectionInvoices}
      count={String(invoices.length)}
    >
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{quick.invoicesEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between gap-3 py-1 font-mono text-sm"
            >
              <span className="truncate">{invoice.invoiceNumber}</span>
              <Badge variant="outline" className="font-sans text-[10px] uppercase">
                {invoice.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function PaymentScheduleSection({ booking, locale }: { booking: BookingRecord; locale: string }) {
  const messages = useBookingsUiMessagesOrDefault()
  const detail = messages.bookingDetailPage
  const quick = messages.bookingQuickViewSheet
  const { data } = useBookingPaymentSchedules(booking.id)
  const schedules = data?.data ?? []

  const paidCount = schedules.filter((schedule) => schedule.status === "paid").length
  const counter =
    schedules.length === 0 ? "0" : `${paidCount}/${schedules.length} ${quick.scheduleCountSuffix}`

  return (
    <Section
      icon={<Calendar className="h-3.5 w-3.5" />}
      label={quick.sectionPaymentSchedule}
      count={counter}
    >
      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{quick.scheduleEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {schedule.scheduleType}
                </Badge>
                <span className="text-muted-foreground">
                  {formatScheduleDate(schedule.dueDate, locale, detail.noValue)}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {formatAmount(schedule.amountCents, schedule.currency, locale, detail.noValue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function ContractsSection({ bookingId }: { bookingId: string }) {
  const messages = useBookingsUiMessagesOrDefault()
  const quick = messages.bookingQuickViewSheet
  const { data } = useLegalContracts({ bookingId, limit: 20 })
  const contracts = data?.data ?? []

  return (
    <Section
      icon={<ScrollText className="h-3.5 w-3.5" />}
      label={quick.sectionContracts}
      count={String(contracts.length)}
    >
      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{quick.contractsEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {contracts.map((contract) => (
            <li key={contract.id} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="truncate font-mono">
                {contract.contractNumber ?? contract.title}
              </span>
              <Badge variant="outline" className="font-sans text-[10px] uppercase">
                {contract.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: ReactNode
  label: string
  count: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <header className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-mono normal-case">{count}</span>
      </header>
      {children}
    </section>
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function formatScheduleDate(iso: string | null, locale: string, empty: string): string {
  if (!iso) return empty
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })
}
