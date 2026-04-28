"use client"

import { useBookingActivity, useBookingTravelerDocuments } from "@voyantjs/bookings-react"
import { usePublicBookingPayments } from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyantjs/voyant-ui/components"
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

const sourceLabel: Record<TimelineSource, string> = {
  activity: "Activity",
  document: "Document",
  payment: "Payment",
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

  const events = React.useMemo<TimelineEvent[]>(() => {
    const merged: TimelineEvent[] = []

    for (const entry of activityData?.data ?? []) {
      merged.push({
        id: `activity:${entry.id}`,
        source: "activity",
        title: entry.description,
        actorId: entry.actorId,
        timestamp: entry.createdAt,
        icon: activityIcons[entry.activityType] ?? Activity,
      })
    }

    for (const doc of documentsData?.data ?? []) {
      merged.push({
        id: `document:${doc.id}`,
        source: "document",
        title: `${doc.type.replace(/_/g, " ")} uploaded`,
        description: doc.fileName,
        timestamp: doc.createdAt,
        icon: FileText,
        link: { href: doc.fileUrl, label: "View file" },
      })
    }

    for (const payment of paymentsData?.data?.payments ?? []) {
      merged.push({
        id: `payment:${payment.id}`,
        source: "payment",
        title: `Payment ${payment.status} — ${(payment.amountCents / 100).toFixed(2)} ${payment.currency}`,
        description: `Invoice ${payment.invoiceNumber} · ${payment.paymentMethod.replace(/_/g, " ")}`,
        timestamp: payment.paymentDate,
        icon: CreditCard,
      })
    }

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged
  }, [activityData, documentsData, paymentsData])

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)

  const filterChips: Filter[] = ["all", "activity", "document", "payment"]

  return (
    <Card data-slot="booking-activity-timeline">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Timeline
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
              {chip === "all" ? "All" : sourceLabel[chip]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((event) => (
              <TimelineEventItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const Icon = event.icon
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
          {event.actorId && event.actorId !== "system" ? `By ${event.actorId} · ` : ""}
          {new Date(event.timestamp).toLocaleString()}
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
