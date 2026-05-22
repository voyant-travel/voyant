"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { buildPaymentLinkUrl } from "@voyantjs/finance/payment-link"
import { PaymentSessionActionLedgerCard } from "@voyantjs/finance-ui/components/invoice-action-ledger-card"
import { formatMessage } from "@voyantjs/i18n"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Copy, Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"

import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

type PaymentSessionsMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["paymentSessions"]

interface PendingPaymentSession {
  id: string
  status: string
  amountCents: number
  currency: string
  provider: string | null
  notes: string | null
  payerName: string | null
  payerEmail: string | null
  createdAt: string
  invoiceId: string | null
}

interface ListResponse {
  data: PendingPaymentSession[]
  total: number
}

interface PaymentLinkConfigResponse {
  data: {
    publicCheckoutBaseUrl?: string | null
  }
}

/**
 * Operator-side panel that lists payment_sessions still in `pending`
 * for a given booking and offers a one-click "Mark received" action.
 *
 * Calling /v1/admin/finance/payment-sessions/:id/complete with
 * `status: "paid"` writes a payment authorization + capture row
 * and emits `payment.completed`, which fires the storefront's
 * checkout-finalize workflow (final invoice, contract auto-gen).
 *
 * Bank-transfer is the canonical use case — the storefront creates
 * a pending session at checkout-start time so this UI has something
 * to act on.
 */
export interface BookingPendingPaymentSessionsProps {
  bookingId: string
}

export function BookingPendingPaymentSessions({
  bookingId,
}: BookingPendingPaymentSessionsProps): React.ReactElement | null {
  const t = useAdminMessages().bookings.detail.paymentSessions
  const queryClient = useQueryClient()
  const queryKey = ["booking-pending-payment-sessions", bookingId]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.get<ListResponse>(
        `/v1/admin/finance/payment-sessions?bookingId=${encodeURIComponent(
          bookingId,
        )}&status=pending&limit=10`,
      ),
  })
  const { data: paymentLinkConfig } = useQuery({
    queryKey: ["payment-link-config"],
    queryFn: () => api.get<PaymentLinkConfigResponse>("/v1/public/payment-link-config"),
    staleTime: 5 * 60 * 1000,
  })

  const markReceived = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(
        `/v1/admin/finance/payment-sessions/${encodeURIComponent(sessionId)}/complete`,
        {
          status: "paid",
          captureMode: "manual",
          paymentMethod: "bank_transfer",
          paymentDate: new Date().toISOString(),
          authorizedAt: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      // The completion fires payment.completed, which kicks off the
      // checkout-finalize workflow → booking.confirmed → contract +
      // invoice auto-gen. Refresh the surrounding booking data so
      // the operator sees the new status without a hard reload.
      void queryClient.invalidateQueries({ queryKey: ["public-booking-detail", bookingId] })
      void queryClient.invalidateQueries({ queryKey: ["public-booking-payments", bookingId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.actionLedger(bookingId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionLedger.all })
    },
  })

  const sessions = data?.data ?? []
  if (!isLoading && sessions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          {t.pendingTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.loadingSessions}
          </div>
        ) : null}
        {sessions.map((session) => (
          <div key={session.id} className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">
                  {formatMoney(session.amountCents, session.currency)}
                  {session.provider ? (
                    <span className="ml-2 text-muted-foreground text-xs uppercase">
                      {session.provider}
                    </span>
                  ) : null}
                </div>
                {session.notes ? (
                  <div className="text-muted-foreground text-xs">{session.notes}</div>
                ) : null}
                <div className="text-muted-foreground text-xs">
                  {formatMessage(t.createdAtPlain, {
                    date: new Date(session.createdAt).toLocaleString(),
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyPaymentLink(
                      session.id,
                      paymentLinkConfig?.data.publicCheckoutBaseUrl,
                      t,
                    )
                  }
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t.copyPaymentLink}
                </Button>
                <Button
                  size="sm"
                  onClick={() => markReceived.mutate(session.id)}
                  disabled={markReceived.isPending}
                >
                  {markReceived.isPending && markReceived.variables === session.id ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t.marking}
                    </>
                  ) : (
                    t.markReceived
                  )}
                </Button>
              </div>
            </div>
            <PaymentSessionActionLedgerCard paymentSessionId={session.id} limit={5} />
          </div>
        ))}
        {markReceived.error ? (
          <p className="text-destructive text-xs">
            {markReceived.error instanceof Error
              ? markReceived.error.message
              : t.markReceivedFailed}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

async function copyPaymentLink(
  paymentSessionId: string,
  publicCheckoutBaseUrl: string | null | undefined,
  messages: PaymentSessionsMessages,
): Promise<void> {
  if (typeof window === "undefined") return
  const url = buildPaymentLinkUrl(paymentSessionId, {
    baseUrl: publicCheckoutBaseUrl ?? window.location.origin,
  })
  try {
    await navigator.clipboard.writeText(url)
    toast.success(messages.paymentLinkCopied)
  } catch {
    toast.error(messages.paymentLinkCopyFailed)
  }
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
