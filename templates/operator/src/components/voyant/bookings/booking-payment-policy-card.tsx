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
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

import { getApiUrl } from "@/lib/env"

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
      toast.success("Payment schedule regenerated")
      void queryClient.invalidateQueries({
        queryKey: bookingsQueryKeys.booking(booking.id),
      })
      void queryClient.invalidateQueries({
        queryKey: financeQueryKeys.bookingPaymentSchedules(booking.id),
      })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Regenerate failed")
    },
  })

  const policySourceLabel = (source: PaymentPolicySource | null): string => {
    switch (source) {
      case "booking":
        return "Booking override"
      case "listing":
        return "Listing"
      case "category":
        return "Category"
      case "supplier":
        return "Supplier"
      case "operator_default":
        return "Operator default"
      default:
        return "Not yet computed"
    }
  }

  const persistedHasOverride = persisted !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Payment policy</CardTitle>
          <CardDescription>
            Controls the deposit / balance split applied to this booking's payment schedule.
          </CardDescription>
        </div>
        <Badge variant={persistedHasOverride ? "default" : "outline"}>
          {persistedHasOverride
            ? "Booking override"
            : `Cascade: ${policySourceLabel(resolvedSource)}`}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {persistedHasOverride ? (
          <PaymentPolicyPreview
            policy={persisted}
            currency={booking.sellCurrency ?? "EUR"}
            sampleTotalCents={booking.sellAmountCents ?? 100_000}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            No booking-level override. The schedule below was computed from the{" "}
            {policySourceLabel(resolvedSource).toLowerCase()} policy.
          </p>
        )}

        <div className="flex justify-end gap-2">
          {persistedHasOverride ? (
            <Button
              variant="outline"
              size="sm"
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutate(null)}
            >
              {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Clear override
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            {persistedHasOverride ? "Edit override" : "Override on this booking"}
          </Button>
        </div>

        <PaymentPolicyHistory bookingId={booking.id} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Booking-level payment policy</DialogTitle>
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
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={regenerate.isPending || draft === null}
              onClick={() => regenerate.mutate(draft)}
            >
              {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save + regenerate schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
function PaymentPolicyHistory({ bookingId }: { bookingId: string }) {
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
    return <div className="text-muted-foreground text-xs">Loading history…</div>
  }

  if (policyRows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-muted-foreground text-xs">
        <History className="mr-1 inline-block h-3 w-3" />
        No payment-schedule regenerations recorded yet — the schedule will be generated when the
        booking is confirmed.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <History className="h-3 w-3" />
        Schedule history
      </div>
      <ul className="space-y-2 text-xs">
        {policyRows.map((row) => {
          const meta = (row.metadata as Record<string, unknown> | null) ?? {}
          const source = String(meta.policySource ?? "operator_default")
          const entries = Array.isArray(meta.entries) ? meta.entries : []
          return (
            <li key={row.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {sourceLabel(source as PaymentPolicySource)} → {entries.length} row
                  {entries.length === 1 ? "" : "s"}
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

function sourceLabel(source: PaymentPolicySource): string {
  switch (source) {
    case "booking":
      return "Booking override"
    case "listing":
      return "Listing"
    case "category":
      return "Category"
    case "supplier":
      return "Supplier"
    case "operator_default":
      return "Operator default"
    default:
      return source
  }
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
