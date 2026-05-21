"use client"

import { useQuery } from "@tanstack/react-query"
import { PaymentSessionActionLedgerCard } from "@voyantjs/finance-ui/components/invoice-action-ledger-card"
import { formatMessage } from "@voyantjs/i18n"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { CheckCircle2, ExternalLink } from "lucide-react"

import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

type PaymentSessionsMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["paymentSessions"]

interface PaidPaymentSession {
  id: string
  status: string
  amountCents: number
  currency: string
  provider: string | null
  paymentMethod: string | null
  paymentId: string | null
  invoiceId: string | null
  providerSessionId: string | null
  providerPaymentId: string | null
  externalReference: string | null
  payerName: string | null
  payerEmail: string | null
  completedAt: string | null
  createdAt: string
}

interface ListResponse {
  data: PaidPaymentSession[]
  total: number
}

/**
 * Lists `payment_sessions` in `paid` (or `authorized`) status for a
 * booking. Complements `BookingPendingPaymentSessions` (which only
 * shows actionable pending sessions) and `BookingPaymentsSummary`
 * (which shows the canonical `payments` rows that drive invoice
 * settlement).
 *
 * The point of this card: provide a clear audit trail. Each card
 * shows session id, provider details (Netopia order id, capture id),
 * and the linked `payments.id` once the checkout-finalize workflow's
 * `link_payment_to_invoice` step runs. Operators can click through
 * to the invoice or read the linked payment row.
 */
export interface BookingPaidPaymentSessionsProps {
  bookingId: string
}

export function BookingPaidPaymentSessions({
  bookingId,
}: BookingPaidPaymentSessionsProps): React.ReactElement | null {
  const t = useAdminMessages().bookings.detail.paymentSessions
  const { data, isLoading } = useQuery({
    queryKey: ["booking-paid-payment-sessions", bookingId],
    queryFn: () =>
      api.get<ListResponse>(
        `/v1/admin/finance/payment-sessions?bookingId=${encodeURIComponent(
          bookingId,
        )}&status=paid&limit=20`,
      ),
  })

  const sessions = data?.data ?? []
  if (isLoading || sessions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {t.paidTitle}
          <Badge variant="outline" className="text-[10px]">
            {sessions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {sessions.map((session) => (
          <div key={session.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-medium">
                {formatMoney(session.amountCents, session.currency)}
                {session.provider ? (
                  <span className="ml-2 text-muted-foreground text-xs uppercase">
                    {session.provider}
                    {session.paymentMethod ? ` · ${session.paymentMethod}` : ""}
                  </span>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">
                {session.completedAt
                  ? formatMessage(t.paidAt, {
                      date: new Date(session.completedAt).toLocaleString(),
                    })
                  : formatMessage(t.createdAt, {
                      date: new Date(session.createdAt).toLocaleString(),
                    })}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Row label={t.sessionLabel} value={session.id} />
              {session.providerSessionId ? (
                <Row
                  label={
                    session.provider
                      ? formatMessage(t.providerSession, { provider: session.provider })
                      : t.providerSessionFallback
                  }
                  value={session.providerSessionId}
                />
              ) : null}
              {session.providerPaymentId ? (
                <Row
                  label={
                    session.provider
                      ? formatMessage(t.providerPayment, { provider: session.provider })
                      : t.providerPaymentFallback
                  }
                  value={session.providerPaymentId}
                />
              ) : null}
              {session.externalReference ? (
                <Row label={t.externalRef} value={session.externalReference} />
              ) : null}
              {session.invoiceId ? (
                <Row label={t.invoiceLabel} value={session.invoiceId} />
              ) : (
                <Row label={t.invoiceLabel} value={<NotLinked messages={t} />} />
              )}
              {session.paymentId ? (
                <Row label={t.paymentRowLabel} value={session.paymentId} />
              ) : session.invoiceId ? (
                <Row
                  label={t.paymentRowLabel}
                  value={<span className="text-amber-600">{t.pendingReconciliation}</span>}
                />
              ) : null}
            </dl>

            <PaymentSessionActionLedgerCard paymentSessionId={session.id} limit={5} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="min-w-0 truncate font-mono">{value}</dd>
    </div>
  )
}

function NotLinked({ messages }: { messages: PaymentSessionsMessages }): React.ReactElement {
  // The session was paid but no `link_payment_to_invoice` step has
  // back-linked it yet. Common transient state right after the
  // Netopia callback fires; resolves when checkout-finalize completes.
  return (
    <span className="inline-flex items-center gap-1 text-amber-600">
      {messages.notLinked}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </span>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
