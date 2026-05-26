"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { bookingsQueryKeys } from "@voyantjs/bookings-react"
import { IconActionButton, StatusBadge, useBookingsUiI18nOrDefault } from "@voyantjs/bookings-ui"
import { buildPaymentLinkUrl } from "@voyantjs/finance/payment-link"
import { financeQueryKeys } from "@voyantjs/finance-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voyantjs/ui/components"
import { Button } from "@voyantjs/ui/components/button"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyantjs/ui/components/tooltip"
import { Check, Copy, Loader2, Plus, Trash2, Wallet } from "lucide-react"
import * as React from "react"
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

export interface BookingPendingPaymentSessionsProps {
  bookingId: string
  /**
   * Opens the operator's `Generate payment link` flow. When provided,
   * the section header renders a primary button that triggers it.
   */
  onGenerateLink?: () => void
  /**
   * When set, the Generate payment link button is rendered disabled and
   * its tooltip shows this reason — e.g. "Booking is fully paid."
   */
  generateLinkDisabledReason?: string | null
}

export function BookingPendingPaymentSessions({
  bookingId,
  onGenerateLink,
  generateLinkDisabledReason,
}: BookingPendingPaymentSessionsProps): React.ReactElement {
  const t = useAdminMessages().bookings.detail.paymentSessions
  const { formatDateTime } = useBookingsUiI18nOrDefault()
  const queryClient = useQueryClient()
  const queryKey = ["booking-pending-payment-sessions", bookingId]
  const [cancelTarget, setCancelTarget] = React.useState<PendingPaymentSession | null>(null)

  const { data } = useQuery({
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

  const invalidateSurroundings = () => {
    void queryClient.invalidateQueries({ queryKey })
    void queryClient.invalidateQueries({ queryKey: ["public-booking-detail", bookingId] })
    void queryClient.invalidateQueries({ queryKey: ["public-booking-payments", bookingId] })
    void queryClient.invalidateQueries({
      queryKey: financeQueryKeys.adminBookingPayments(bookingId),
    })
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.actionLedger(bookingId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionLedger.all })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
  }

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
    onSuccess: invalidateSurroundings,
  })

  const cancelSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(
        `/v1/admin/finance/payment-sessions/${encodeURIComponent(sessionId)}/cancel`,
        {},
      )
    },
    onSuccess: () => {
      invalidateSurroundings()
      setCancelTarget(null)
    },
  })

  const sessions = data?.data ?? []

  const columns = React.useMemo<ColumnDef<PendingPaymentSession>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t.columnDate,
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "amountCents",
        header: t.columnAmount,
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {formatMoney(row.original.amountCents, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t.columnStatus,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {t.statusLabels[row.original.status as keyof typeof t.statusLabels] ??
              row.original.status}
          </StatusBadge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const session = row.original
          const isMarkingThis = markReceived.isPending && markReceived.variables === session.id
          return (
            <div className="flex items-center justify-end gap-1">
              <IconActionButton
                label={t.copyPaymentLink}
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() =>
                  void copyPaymentLink(session.id, paymentLinkConfig?.data.publicCheckoutBaseUrl, t)
                }
              />
              <IconActionButton
                label={t.markReceived}
                icon={
                  isMarkingThis ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )
                }
                disabled={markReceived.isPending}
                onClick={() => markReceived.mutate(session.id)}
              />
              <IconActionButton
                label={t.cancelPaymentLink}
                icon={<Trash2 className="h-3.5 w-3.5" />}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCancelTarget(session)}
              />
            </div>
          )
        },
      },
    ],
    [
      formatDateTime,
      markReceived.isPending,
      markReceived.mutate,
      markReceived.variables,
      paymentLinkConfig,
      t,
    ],
  )

  return (
    <div data-slot="booking-payment-links" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="h-4 w-4" />
          {t.pendingTitle}
        </h2>
        {onGenerateLink ? (
          generateLinkDisabledReason ? (
            <Tooltip>
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: required so disabled-button tooltips remain keyboard-discoverable */}
              <TooltipTrigger render={<span tabIndex={0} className="inline-block" />}>
                <Button variant="outline" size="sm" disabled className="pointer-events-none">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.generatePaymentLink}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{generateLinkDisabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" size="sm" onClick={onGenerateLink}>
              <Plus className="mr-2 h-4 w-4" />
              {t.generatePaymentLink}
            </Button>
          )
        ) : null}
      </div>

      <DataTable columns={columns} data={sessions} emptyMessage={t.empty} showPagination={false} />

      {markReceived.error ? (
        <p className="text-destructive text-xs">
          {markReceived.error instanceof Error ? markReceived.error.message : t.markReceivedFailed}
        </p>
      ) : null}

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(next) => {
          if (!next && !cancelSession.isPending) setCancelTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cancelConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.cancelConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSession.isPending}>
              {t.cancelConfirmCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelSession.isPending}
              onClick={() => cancelTarget && cancelSession.mutate(cancelTarget.id)}
            >
              {t.cancelConfirmConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
