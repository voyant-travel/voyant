"use client"

import { useAdminBookingPayments, usePublicBookingPayments } from "@voyant-travel/finance-react"
import { Badge, Button } from "@voyant-travel/ui/components"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@voyant-travel/ui/components/pagination"
import {
  Activity,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  type LucideIcon,
  Pencil,
  Plus,
  RefreshCw,
  UserPlus,
} from "lucide-react"
import * as React from "react"
import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import { useBookingActivity, useBookingTravelerDocuments } from "../index.js"

export interface BookingActivityTimelineProps {
  bookingId: string
  /**
   * Which finance API surface should provide payment events. Public/customer
   * contexts use the public endpoint by default; admin booking pages must use
   * the admin endpoint because public checkout capabilities are not present in
   * an operator session.
   */
  paymentsVariant?: "public" | "admin"
  /**
   * Extra events to merge into the timeline alongside the built-in
   * activity / document / payment sources. Operator starters pass
   * action-ledger entries through here so the timeline stays a single
   * chronological feed instead of getting split across tabs.
   */
  additionalEvents?: readonly TimelineEvent[]
  /** Rendered below the pagination — e.g. a "load more" pager for action-ledger entries. */
  footer?: React.ReactNode
  /** Page size for the client-side pager. Defaults to 10. */
  pageSize?: number
}

export type TimelineSource = "activity" | "document" | "payment" | "action"

export type TimelineEvent = {
  id: string
  source: TimelineSource
  title: string
  description?: string | null
  actorId?: string | null
  timestamp: string
  icon: LucideIcon
  link?: { href: string; label: string }
}

const activityIcons: Record<string, LucideIcon> = {
  booking_created: Plus,
  booking_reserved: Plus,
  booking_converted: RefreshCw,
  booking_confirmed: Clock,
  hold_extended: Clock,
  hold_expired: Clock,
  status_change: Clock,
  item_update: Pencil,
  allocation_released: Clock,
  fulfillment_issued: FileText,
  fulfillment_updated: FileText,
  redemption_recorded: FileText,
  supplier_update: RefreshCw,
  traveler_update: UserPlus,
  note_added: Pencil,
  system_action: Clock,
}

const sourceVariant: Record<TimelineSource, "default" | "secondary" | "outline"> = {
  activity: "outline",
  document: "secondary",
  payment: "default",
  action: "secondary",
}

type Filter = TimelineSource | "all"

export function BookingActivityTimeline({
  bookingId,
  paymentsVariant = "public",
  additionalEvents,
  footer,
  pageSize = 10,
}: BookingActivityTimelineProps) {
  const [filter, setFilter] = React.useState<Filter>("all")
  const [pageIndex, setPageIndex] = React.useState(0)
  const { data: activityData } = useBookingActivity(bookingId)
  const { data: documentsData } = useBookingTravelerDocuments(bookingId)
  const publicPaymentsQuery = usePublicBookingPayments(bookingId, {
    enabled: paymentsVariant === "public",
  })
  const adminPaymentsQuery = useAdminBookingPayments(bookingId, {
    enabled: paymentsVariant === "admin",
  })
  const paymentsData =
    paymentsVariant === "admin" ? adminPaymentsQuery.data : publicPaymentsQuery.data
  const { formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const sourceLabel: Record<TimelineSource, string> = {
    activity: messages.bookingActivityTimeline.sourceLabels.activity,
    document: messages.bookingActivityTimeline.sourceLabels.document,
    payment: messages.bookingActivityTimeline.sourceLabels.payment,
    action: messages.bookingActivityTimeline.sourceLabels.action,
  }

  const events = React.useMemo<TimelineEvent[]>(() => {
    const merged: TimelineEvent[] = []

    for (const entry of activityData?.data ?? []) {
      merged.push({
        id: `activity:${entry.id}`,
        source: "activity",
        title:
          entry.activityType === "note_added"
            ? entry.description
            : (messages.bookingActivityTimeline.activityTitles[entry.activityType] ??
              entry.description),
        description: entry.description,
        // Prefer the hydrated display name; fall back to email then raw
        // id (system actors stay null and skip the "By …" render).
        actorId: entry.actorName || entry.actorEmail || entry.actorId,
        timestamp: entry.createdAt,
        icon: activityIcons[entry.activityType] ?? Activity,
      })
    }

    for (const doc of documentsData?.data ?? []) {
      merged.push({
        id: `document:${doc.id}`,
        source: "document",
        title: `${doc.type.replace(/_/g, " ")} ${messages.bookingActivityTimeline.documentUploadedSuffix}`,
        description: doc.fileName,
        timestamp: doc.createdAt,
        icon: FileText,
        link: { href: doc.fileUrl, label: messages.bookingActivityTimeline.viewFile },
      })
    }

    for (const payment of paymentsData?.data?.payments ?? []) {
      const status =
        messages.bookingPaymentsSummary.paymentStatusLabels[
          payment.status as keyof typeof messages.bookingPaymentsSummary.paymentStatusLabels
        ] ?? payment.status
      const amount = `${formatNumber(payment.amountCents / 100, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${payment.currency}`
      const method =
        messages.bookingPaymentsSummary.paymentMethodLabels[
          payment.paymentMethod as keyof typeof messages.bookingPaymentsSummary.paymentMethodLabels
        ] ?? payment.paymentMethod
      merged.push({
        id: `payment:${payment.id}`,
        source: "payment",
        title: formatMessage(messages.bookingActivityTimeline.paymentTitle, { status, amount }),
        description: formatMessage(messages.bookingActivityTimeline.paymentDescription, {
          invoice: payment.invoiceNumber,
          method,
        }),
        timestamp: payment.paymentDate,
        icon: CreditCard,
      })
    }

    for (const extra of additionalEvents ?? []) {
      merged.push(extra)
    }

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged
  }, [activityData, additionalEvents, documentsData, formatNumber, messages, paymentsData])

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const pagedVisible = visible.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize)

  // Reset to page 1 whenever the filter changes. React's recommended
  // pattern for derived state reset — cheaper and lint-clean compared
  // to a useEffect.
  const [lastFilter, setLastFilter] = React.useState(filter)
  if (filter !== lastFilter) {
    setLastFilter(filter)
    setPageIndex(0)
  }

  const hasActionEvents = (additionalEvents?.length ?? 0) > 0
  const filterChips: Filter[] = hasActionEvents
    ? ["all", "activity", "document", "payment", "action"]
    : ["all", "activity", "document", "payment"]

  return (
    <div data-slot="booking-activity-timeline" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {messages.bookingActivityTimeline.title}
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((chip) => (
            <Button
              key={chip}
              variant={filter === chip ? "default" : "ghost"}
              size="sm"
              className="h-7 capitalize"
              onClick={() => setFilter(chip)}
            >
              {chip === "all" ? messages.bookingActivityTimeline.filters.all : sourceLabel[chip]}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">{messages.bookingActivityTimeline.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pagedVisible.map((event) => (
            <TimelineEventItem key={event.id} event={event} sourceLabel={sourceLabel} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <TimelinePagination
          pageIndex={safePageIndex}
          pageCount={pageCount}
          onPageChange={setPageIndex}
        />
      ) : null}
      {footer ? <div className="mt-1 flex justify-center">{footer}</div> : null}
    </div>
  )
}

function TimelinePagination({
  pageIndex,
  pageCount,
  onPageChange,
}: {
  pageIndex: number
  pageCount: number
  onPageChange: (next: number) => void
}) {
  const canPrev = pageIndex > 0
  const canNext = pageIndex + 1 < pageCount
  // Compact, ellipsis-less list — the timeline rarely paginates past a
  // handful of pages, and the cards are dense, so a chunky pager would
  // overwhelm. If we hit > 7 pages in practice we can revisit and add
  // PaginationEllipsis.
  const pages = Array.from({ length: pageCount }, (_, idx) => idx)
  return (
    <Pagination className="mt-1">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={!canPrev}
            tabIndex={canPrev ? 0 : -1}
            className={canPrev ? undefined : "pointer-events-none opacity-50"}
            onClick={(event) => {
              event.preventDefault()
              if (canPrev) onPageChange(pageIndex - 1)
            }}
            href="#"
          />
        </PaginationItem>
        {pages.map((idx) => (
          <PaginationItem key={idx}>
            <PaginationLink
              isActive={idx === pageIndex}
              onClick={(event) => {
                event.preventDefault()
                onPageChange(idx)
              }}
              href="#"
            >
              {idx + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            aria-disabled={!canNext}
            tabIndex={canNext ? 0 : -1}
            className={canNext ? undefined : "pointer-events-none opacity-50"}
            onClick={(event) => {
              event.preventDefault()
              if (canNext) onPageChange(pageIndex + 1)
            }}
            href="#"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function TimelineEventItem({
  event,
  sourceLabel,
}: {
  event: TimelineEvent
  sourceLabel: Record<TimelineSource, string>
}) {
  const Icon = event.icon
  const { formatDateTime } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium capitalize">{event.title}</p>
          <Badge variant={sourceVariant[event.source]} className="text-xs">
            {sourceLabel[event.source]}
          </Badge>
        </div>
        {event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.actorId && event.actorId !== "system"
            ? formatMessage(messages.bookingActivityTimeline.byActor, {
                actor: event.actorId,
                timestamp: formatDateTime(event.timestamp),
              })
            : formatDateTime(event.timestamp)}
        </p>
        {event.link && (
          <a
            href={event.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {event.link.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}
