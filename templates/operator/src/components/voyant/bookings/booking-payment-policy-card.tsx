"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  type BookingPaymentPolicy,
  type BookingRecord,
  bookingsQueryKeys,
  useBookingActivity,
} from "@voyantjs/bookings-react"
import type { PaymentPolicy, PaymentPolicySource } from "@voyantjs/finance"
import { financeQueryKeys } from "@voyantjs/finance-react"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import { formatMessage } from "@voyantjs/i18n"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components"
import { History, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"

type PaymentPolicyCardMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["paymentPolicyCard"]

/**
 * Booking detail → Finance tab → Payment-policy card.
 *
 * Surfaces the cascade trace (which layer's policy applied to this
 * booking's schedule) and lets ops override the policy + regenerate
 * the schedule. Mounted above the schedule list so the operator
 * sees both the rule and the generated installments together.
 */
export function BookingPaymentPolicyCard({ booking }: { booking: BookingRecord }) {
  const queryClient = useQueryClient()
  const t = useAdminMessages().bookings.detail.paymentPolicyCard
  const persisted = (booking.customerPaymentPolicy as PaymentPolicy | null | undefined) ?? null
  const [draft, setDraft] = useState<PaymentPolicy | null>(persisted)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resolvedSource, setResolvedSource] = useState<PaymentPolicySource | null>(null)

  // Read the current cascade source from the booking's
  // internalNotes marker (stamped by the schedule subscriber). This
  // is best-effort — if the booking hasn't been confirmed yet, no
  // marker exists and the badge falls back to "(not yet computed)".
  const initialSource = useMemo<PaymentPolicySource | null>(() => {
    return readSourceFromNotes(booking.internalNotes ?? "") ?? null
  }, [booking.internalNotes])

  useEffect(() => {
    setResolvedSource(initialSource)
  }, [initialSource])

  useEffect(() => {
    setDraft(persisted)
  }, [persisted])

  const regenerate = useMutation({
    mutationFn: async (policy: PaymentPolicy | null) => {
      const res = await fetch(
        `${getApiUrl()}/v1/admin/bookings/${booking.id}/payment-schedule/regenerate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerPaymentPolicy: (policy as BookingPaymentPolicy | null) ?? null,
          }),
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Regenerate failed (${res.status})`)
      }
      return (await res.json()) as {
        data: {
          schedule: Array<{ scheduleType: string; amountCents: number; dueDate: string }>
          bookingPolicy: BookingPaymentPolicy | null
          cascadeSource: PaymentPolicySource
        }
      }
    },
    onSuccess: ({ data }) => {
      setResolvedSource(data.cascadeSource)
      toast.success(t.regenerateSucceeded)
      void queryClient.invalidateQueries({
        queryKey: bookingsQueryKeys.booking(booking.id),
      })
      void queryClient.invalidateQueries({
        queryKey: financeQueryKeys.bookingPaymentSchedules(booking.id),
      })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t.regenerateFailed)
    },
  })

  const policySourceLabel = (source: PaymentPolicySource | null): string => {
    if (!source) return t.sourceLabels.unknown
    return t.sourceLabels[source as keyof typeof t.sourceLabels] ?? source
  }

  const persistedHasOverride = persisted !== null

  return (
    <div data-slot="booking-payment-policy" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.description}</p>
        <Badge variant={persistedHasOverride ? "default" : "outline"}>
          {persistedHasOverride
            ? t.sourceLabels.booking
            : formatMessage(t.cascadePrefix, { source: policySourceLabel(resolvedSource) })}
        </Badge>
      </div>

      <div className="rounded-md border p-4">
        {persistedHasOverride ? (
          <PaymentPolicyPreview
            policy={persisted}
            currency={booking.sellCurrency ?? "EUR"}
            sampleTotalCents={booking.sellAmountCents ?? 100_000}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            {formatMessage(t.noOverrideHint, {
              source: policySourceLabel(resolvedSource).toLowerCase(),
            })}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {persistedHasOverride ? (
          <Button
            variant="outline"
            size="sm"
            disabled={regenerate.isPending}
            onClick={() => regenerate.mutate(null)}
          >
            {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t.clearOverride}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          {persistedHasOverride ? t.editOverride : t.addOverride}
        </Button>
      </div>

      <PaymentPolicyHistory bookingId={booking.id} messages={t} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <PaymentPolicyForm
              value={draft}
              onChange={setDraft}
              inheritable={false}
              currency={booking.sellCurrency ?? "EUR"}
              disabled={regenerate.isPending}
            />
            <PaymentPolicyPreview
              policy={draft}
              currency={booking.sellCurrency ?? "EUR"}
              sampleTotalCents={booking.sellAmountCents ?? 100_000}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={regenerate.isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={regenerate.isPending || draft === null}
              onClick={() => regenerate.mutate(draft)}
            >
              {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.saveAndRegenerate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Inline history of payment-schedule regenerations for this booking.
 *
 * Reads the `booking_activity_log` table (filtered to entries the
 * scheduler tagged with `metadata.kind === "payment_schedule_regenerated"`)
 * and renders the most recent ten entries — operator sees the
 * cascade-source chain over time and can spot when the schedule was
 * last regenerated.
 *
 * The Activity tab on the booking page already shows the full
 * timeline; this card-local view is just the policy slice for
 * convenience.
 */
function PaymentPolicyHistory({
  bookingId,
  messages,
}: {
  bookingId: string
  messages: PaymentPolicyCardMessages
}) {
  const { data, isLoading } = useBookingActivity(bookingId)
  const rows = Array.isArray(data) ? data : (data?.data ?? [])
  const policyRows = rows
    .filter(
      (row) =>
        row.activityType === "system_action" &&
        (row.metadata as Record<string, unknown> | null)?.kind === "payment_schedule_regenerated",
    )
    .slice(0, 10)

  if (isLoading) {
    return <div className="text-muted-foreground text-xs">{messages.historyLoading}</div>
  }

  if (policyRows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-muted-foreground text-xs">
        <History className="mr-1 inline-block h-3 w-3" />
        {messages.historyEmpty}
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <History className="h-3 w-3" />
        {messages.historyTitle}
      </div>
      <ul className="space-y-2 text-xs">
        {policyRows.map((row) => {
          const meta = (row.metadata as Record<string, unknown> | null) ?? {}
          const source = String(meta.policySource ?? "operator_default")
          const entries = Array.isArray(meta.entries) ? meta.entries : []
          const sourceLabel =
            messages.sourceLabels[source as keyof typeof messages.sourceLabels] ?? source
          const template =
            entries.length === 1 ? messages.historyRowSingular : messages.historyRowPlural
          return (
            <li key={row.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {formatMessage(template, { source: sourceLabel, count: entries.length })}
                </span>
                <span className="font-mono text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </div>
              <span className="text-muted-foreground">{row.description}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const POLICY_SOURCE_MARKER_PREFIX = "__payment_policy_source__:"

function readSourceFromNotes(notes: string): PaymentPolicySource | null {
  for (const line of notes.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(POLICY_SOURCE_MARKER_PREFIX)) {
      const value = trimmed.slice(POLICY_SOURCE_MARKER_PREFIX.length).trim()
      if (
        value === "booking" ||
        value === "listing" ||
        value === "category" ||
        value === "supplier" ||
        value === "operator_default"
      ) {
        return value
      }
    }
  }
  return null
}
