"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useLocale, useOperatorAdminMessages } from "@voyant-travel/admin"
import { bookingsQueryKeys, useBookingActivity } from "@voyant-travel/bookings-react"
import type { BookingDetailHostSlotContext } from "@voyant-travel/bookings-react/admin"
import type { PaymentPolicy, PaymentPolicySource } from "@voyant-travel/finance/payment-policy"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyant-travel/ui/components"
import { ChevronDown, History, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PaymentPolicyForm, PaymentPolicyPreview } from "../components/payment-policy-form.js"
import { type FinancePaymentPolicy, useBookingPaymentScheduleRegenerateMutation } from "../index.js"

type PaymentPolicyCardMessages = ReturnType<
  typeof useOperatorAdminMessages
>["bookings"]["detail"]["paymentPolicyCard"]

/**
 * Props of the payment-policy widget: exactly the slot context the
 * bookings detail host hands to `booking.details.finance-end` widget
 * contributions (see `bookingDetailFinanceEndSlot` in
 * `@voyant-travel/bookings-react/admin`).
 */
export type BookingPaymentPolicyWidgetProps = BookingDetailHostSlotContext

/**
 * Booking detail → Finance tab → Payment-policy card, delivered as a
 * widget contribution on `booking.details.finance-end` (packaged-admin RFC
 * §4.7 cycle resolution: this package depends on `@voyant-travel/bookings-react/ui`,
 * so the bookings host cannot import the card — finance contributes it).
 *
 * Surfaces the cascade trace (which layer's policy applied to this
 * booking's schedule) and lets ops override the policy + regenerate the
 * schedule. Mounted below the schedule list, collapsed by default, so the
 * operator sees both the rule and the generated installments together.
 */
export function BookingPaymentPolicyWidget({ booking }: BookingPaymentPolicyWidgetProps) {
  const t = useOperatorAdminMessages().bookings.detail.paymentPolicyCard

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border bg-background px-4 py-3 text-sm font-semibold hover:bg-muted/30">
        {t.title}
        <ChevronDown className="h-4 w-4 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <BookingPaymentPolicyCard booking={booking} messages={t} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function BookingPaymentPolicyCard({
  booking,
  messages: t,
}: {
  booking: BookingDetailHostSlotContext["booking"]
  messages: PaymentPolicyCardMessages
}) {
  const queryClient = useQueryClient()
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

  const regenerate = useBookingPaymentScheduleRegenerateMutation(booking.id)

  const submitPolicy = (policy: PaymentPolicy | null) => {
    regenerate.mutate(
      { customerPaymentPolicy: (policy as FinancePaymentPolicy | null) ?? null },
      {
        onSuccess: ({ cascadeSource }) => {
          setResolvedSource(cascadeSource)
          toast.success(t.regenerateSucceeded)
          // The hook already refreshes the schedule list; the booking
          // record carries the persisted override, so refresh it too.
          void queryClient.invalidateQueries({
            queryKey: bookingsQueryKeys.booking(booking.id),
          })
          setDialogOpen(false)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : t.regenerateFailed)
        },
      },
    )
  }

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
            onClick={() => submitPolicy(null)}
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
              onClick={() => submitPolicy(draft)}
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
  const { resolvedLocale } = useLocale()
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
                  {new Date(row.createdAt).toLocaleString(resolvedLocale)}
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
