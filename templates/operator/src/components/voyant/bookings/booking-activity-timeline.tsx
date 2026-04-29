"use client"

import { formatMessage, useLocale } from "@voyantjs/admin"
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
import { useAdminMessages } from "@/lib/admin-i18n"

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

function getPaymentMethodLabel(
  method: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["payments"],
) {
  switch (method) {
    case "bank_transfer":
      return messages.methodBankTransfer
    case "credit_card":
      return messages.methodCreditCard
    case "cash":
      return messages.methodCash
    case "cheque":
      return messages.methodCheque
    case "other":
      return messages.methodOther
    default:
      return method.replace(/_/g, " ")
  }
}

function getPaymentStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["payments"],
) {
  switch (status) {
    case "pending":
      return messages.statusPending
    case "completed":
      return messages.statusCompleted
    case "failed":
      return messages.statusFailed
    case "refunded":
      return messages.statusRefunded
    default:
      return status.replace(/_/g, " ")
  }
}

function getDocumentTypeLabel(
  type: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["documents"],
) {
  switch (type) {
    case "visa":
      return messages.typeVisa
    case "insurance":
      return messages.typeInsurance
    case "health":
      return messages.typeHealth
    case "passport_copy":
      return messages.typePassportCopy
    case "other":
      return messages.typeOther
    default:
      return type.replace(/_/g, " ")
  }
}

function getSourceLabel(
  source: TimelineSource,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["activity"],
) {
  switch (source) {
    case "activity":
      return messages.sourceActivity
    case "document":
      return messages.sourceDocument
    case "payment":
      return messages.sourcePayment
  }
}

export function BookingActivityTimeline({ bookingId }: BookingActivityTimelineProps) {
  const messages = useAdminMessages()
  const activityMessages = messages.bookings.detail.activity
  const paymentMessages = messages.bookings.detail.payments
  const documentMessages = messages.bookings.detail.documents
  const { resolvedLocale } = useLocale()
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
        title: `${getDocumentTypeLabel(doc.type, documentMessages)} ${activityMessages.uploadedSuffix}`,
        description: doc.fileName,
        timestamp: doc.createdAt,
        icon: FileText,
        link: { href: doc.fileUrl, label: activityMessages.viewFile },
      })
    }

    for (const payment of paymentsData?.data?.payments ?? []) {
      const paymentStatus = getPaymentStatusLabel(payment.status, paymentMessages)
      merged.push({
        id: `payment:${payment.id}`,
        source: "payment",
        title: formatMessage(activityMessages.paymentTitle, {
          status: paymentStatus,
          amount: (payment.amountCents / 100).toFixed(2),
          currency: payment.currency,
        }),
        description: formatMessage(activityMessages.paymentDescription, {
          invoice: payment.invoiceNumber,
          method: getPaymentMethodLabel(payment.paymentMethod, paymentMessages),
        }),
        timestamp: payment.paymentDate,
        icon: CreditCard,
      })
    }

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged
  }, [
    activityData,
    activityMessages,
    documentMessages,
    documentsData,
    paymentMessages,
    paymentsData,
  ])

  const visible = filter === "all" ? events : events.filter((e) => e.source === filter)

  const filterChips: Filter[] = ["all", "activity", "document", "payment"]

  return (
    <Card data-slot="booking-activity-timeline">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {activityMessages.title}
        </CardTitle>
        <div className="flex items-center gap-1">
          {filterChips.map((chip) => (
            <Button
              key={chip}
              variant={filter === chip ? "default" : "ghost"}
              size="sm"
              className="h-7"
              onClick={() => setFilter(chip)}
            >
              {chip === "all"
                ? activityMessages.filterAll
                : chip === "activity"
                  ? activityMessages.filterActivity
                  : chip === "document"
                    ? activityMessages.filterDocument
                    : activityMessages.filterPayment}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{activityMessages.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((event) => (
              <TimelineEventItem
                key={event.id}
                event={event}
                resolvedLocale={resolvedLocale}
                activityMessages={activityMessages}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineEventItem({
  event,
  resolvedLocale,
  activityMessages,
}: {
  event: TimelineEvent
  resolvedLocale: string
  activityMessages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["activity"]
}) {
  const Icon = event.icon
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{event.title}</p>
          <Badge variant={sourceVariant[event.source]} className="text-xs">
            {getSourceLabel(event.source, activityMessages)}
          </Badge>
        </div>
        {event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.actorId && event.actorId !== "system"
            ? formatMessage(activityMessages.byActorPrefix, { actor: event.actorId })
            : ""}
          {new Date(event.timestamp).toLocaleString(resolvedLocale)}
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
