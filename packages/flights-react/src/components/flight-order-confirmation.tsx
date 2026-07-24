"use client"

import type { FlightOrder } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Separator } from "@voyant-travel/ui/components/separator"
import { cn } from "@voyant-travel/ui/lib/utils"
import { CheckCircle2, Clock, Mail, Phone, Ticket, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { useFlightsUiI18nOrDefault } from "../i18n/index.js"
import { FlightOfferDetail } from "./flight-offer-detail.js"

export interface FlightOrderConfirmationProps {
  order: FlightOrder
  /** Optional cancel button — pass when the order is still cancellable. */
  onCancel?: (order: FlightOrder) => void
  cancelLoading?: boolean
  /**
   * Optional "Issue tickets" button — pass to let the operator promote a held
   * order to ticketed before its deadline. Only rendered while the order is
   * `confirmed` (held).
   */
  onTicket?: (order: FlightOrder) => void
  ticketLoading?: boolean
  /** IATA → human-readable resolvers, forwarded to the embedded offer detail. */
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  aircraftName?: (iataCode: string) => string | undefined
}

const STATUS_VARIANTS: Record<
  FlightOrder["status"],
  { tone: "ok" | "pending" | "bad"; icon: ReactNode }
> = {
  pending: { tone: "pending", icon: <Clock className="h-4 w-4" /> },
  confirmed: { tone: "ok", icon: <CheckCircle2 className="h-4 w-4" /> },
  ticketed: { tone: "ok", icon: <Ticket className="h-4 w-4" /> },
  cancelled: { tone: "bad", icon: <XCircle className="h-4 w-4" /> },
  failed: { tone: "bad", icon: <XCircle className="h-4 w-4" /> },
}

export function FlightOrderConfirmation({
  order,
  onCancel,
  cancelLoading,
  onTicket,
  ticketLoading,
  carrierName,
  airportName,
  aircraftName,
}: FlightOrderConfirmationProps) {
  const i18n = useFlightsUiI18nOrDefault()
  const messages = i18n.messages
  const status = STATUS_VARIANTS[order.status]
  const isCancellable =
    onCancel != null && (order.status === "confirmed" || order.status === "ticketed")
  const isTicketable = onTicket != null && order.status === "confirmed"

  return (
    <div className="flex flex-col gap-6">
      {/* Header card — PNR + status + price */}
      <div className="rounded-md border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {messages.flightOrderConfirmation.bookingConfirmed}
            </span>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-2xl font-semibold tracking-wider">
                {order.pnr ?? order.orderId}
              </h2>
              <Badge
                variant={status.tone === "ok" ? "default" : "secondary"}
                className={cn(
                  "gap-1.5",
                  status.tone === "bad" && "bg-destructive/10 text-destructive",
                )}
              >
                {status.icon}
                {messages.common.orderStatusLabels[order.status]}
              </Badge>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{order.orderId}</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(order.totalPrice.amount, order.totalPrice.currency, i18n)}
            </div>
            <div className="text-xs text-muted-foreground">{messages.common.total}</div>
          </div>
        </div>

        {order.paymentDeadline && order.status === "confirmed" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              {formatMessage(messages.flightOrderConfirmation.ticketDeadline, {
                date: i18n.formatDateTime(order.paymentDeadline),
              })}
            </div>
          </div>
        )}
      </div>

      {/* Passengers */}
      <Section title={messages.flightOrderConfirmation.passengers}>
        <div className="flex flex-col gap-2">
          {order.passengers.map((p) => (
            <div
              key={p.passengerId}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-sm"
            >
              <div className="flex flex-col leading-tight">
                <span className="font-medium">
                  {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {p.type}
                  {p.dateOfBirth &&
                    ` · ${formatMessage(messages.flightOrderConfirmation.dob, {
                      date: p.dateOfBirth,
                    })}`}
                </span>
              </div>
              {order.tickets && (
                <TicketChip
                  number={order.tickets.find((t) => t.passengerId === p.passengerId)?.ticketNumber}
                />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Contact */}
      {(order.contact?.email || order.contact?.phone) && (
        <Section title={messages.flightOrderConfirmation.contact}>
          <div className="flex flex-wrap gap-4 text-sm">
            {order.contact.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {order.contact.email}
              </span>
            )}
            {order.contact.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {order.contact.phone}
              </span>
            )}
          </div>
        </Section>
      )}

      {/* Itinerary + fare breakdown */}
      <Section title={messages.flightOrderConfirmation.itinerary}>
        <FlightOfferDetail
          offer={order.offer}
          carrierName={carrierName}
          airportName={airportName}
          aircraftName={aircraftName}
        />
      </Section>

      {/* Action CTAs — issue tickets (held orders) + cancel */}
      {(isTicketable || isCancellable) && (
        <>
          <Separator />
          <div className="flex justify-end gap-2">
            {isTicketable && (
              <Button onClick={() => onTicket(order)} disabled={ticketLoading}>
                <Ticket className="mr-1.5 h-4 w-4" />
                {ticketLoading
                  ? messages.flightOrderConfirmation.issuingTickets
                  : messages.flightOrderConfirmation.issueTickets}
              </Button>
            )}
            {isCancellable && (
              <Button
                variant="destructive"
                onClick={() => onCancel(order)}
                disabled={cancelLoading}
              >
                {cancelLoading
                  ? messages.flightOrderConfirmation.cancelling
                  : messages.flightOrderConfirmation.cancelBooking}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function TicketChip({ number }: { number: string | undefined }) {
  if (!number) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  return <code className="rounded bg-muted px-2 py-1 font-mono text-[11px]">{number}</code>
}

function formatMoney(
  amount: string,
  currency: string,
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>,
): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return i18n.formatCurrency(n, currency, { maximumFractionDigits: 0 })
}
