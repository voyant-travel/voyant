"use client"

import { useBookingActivity, useBookingTravelerDocuments } from "@voyantjs/bookings-react"
import { usePublicBookingPayments } from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
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
} from "../i18n/provider"

export interface BookingActivityTimelineProps {
  bookingId: string
}

type TimelineSource = "activity" | "document" | "payment"

type TimelineEvent = {
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
  passenger_update: UserPlus,
  note_added: Pencil,
}

const sourceVariant: Record<TimelineSource, "default" | "secondary" | "outline"> = {
  activity: "outline",
  document: "secondary",
  payment: "default",
}

type Filter = TimelineSource | "all"

export function BookingActivityTimeline({ bookingId }: BookingActivityTimelineProps) {
  const [filter, setFilter] = React.useState<Filter>("all")
  const { data: activityData } = useBookingActivity(bookingId)
  const { data: documentsData } = useBookingTravelerDocuments(bookingId)
  const { data: paymentsData } = usePublicBookingPayments(bookingId)
  const { formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const sourceLabel: Record<TimelineSource, string> = {
    activity: messages.bookingActivityTimeline.sourceLabels.activity,
    document: messages.bookingActivityTimeline.sourceLabels.document,
    payment: messages.bookingActivityTimeline.sourceLabels.payment,
  }

  const events = React.useMemo<TimelineEvent[]>(() => {
    const merged: TimelineEvent[] = []

    for (const entry of activityData?.data ?? []) {
      merged.push({
        id: `activity:${entry.id}`,
        source: "activity",
        title:
          messages.bookingActivityTimeline.activityTitles[entry.activityType] ?? entry.description,
        description: entry.description,
        actorId: entry.actorId,
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

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged
  }, [activityData, documentsData, formatNumber, messages, paymentsData])

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)

  const filterChips: Filter[] = ["all", "activity", "document", "payment"]

  return (
    <Card data-slot="booking-activity-timeline">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {messages.bookingActivityTimeline.title}
        </CardTitle>
        <div className="flex items-center gap-1">
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
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingActivityTimeline.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((event) => (
              <TimelineEventItem key={event.id} event={event} sourceLabel={sourceLabel} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
