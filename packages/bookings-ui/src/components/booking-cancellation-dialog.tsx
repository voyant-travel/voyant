"use client"

import {
  type BookingRecord,
  useBookingCancelMutation,
  useBookingPrimaryProduct,
} from "@voyantjs/bookings-react"
import { useEvaluateCancellation, useResolvePolicy } from "@voyantjs/legal-react"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { AlertTriangle, Loader2 } from "lucide-react"
import * as React from "react"

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(0)}%`
}

function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

const refundTypeLabel: Record<string, string> = {
  cash: "Cash refund",
  credit: "Credit",
  cash_or_credit: "Cash or credit",
  none: "No refund",
}

const refundTypeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  cash: "default",
  credit: "secondary",
  cash_or_credit: "secondary",
  none: "destructive",
}

export interface BookingCancellationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: BookingRecord
  /**
   * Product ID used to resolve the applicable cancellation policy.
   *
   * Leave unset (or pass `undefined`) to auto-resolve from the booking's items
   * — this is what you want for single-product bookings. Pass an explicit
   * string or `null` to override (e.g. for multi-product bookings or to force
   * the default non-product-scoped policy).
   */
  productId?: string | null
  onSuccess?: () => void
}

export function BookingCancellationDialog({
  open,
  onOpenChange,
  booking,
  productId,
  onSuccess,
}: BookingCancellationDialogProps) {
  const [reason, setReason] = React.useState("")

  const daysBeforeDeparture = React.useMemo(() => {
    if (!booking.startDate) return 0
    return daysBetween(new Date(), new Date(booking.startDate))
  }, [booking.startDate])

  // When the caller didn't specify a productId, derive one from the booking's
  // items so the consumer doesn't have to wire up `useBookingItems` just for
  // this. Explicit `null` is respected as an override.
  const shouldAutoResolveProduct = productId === undefined
  const autoResolved = useBookingPrimaryProduct(booking.id, {
    enabled: open && shouldAutoResolveProduct,
  })
  const effectiveProductId = shouldAutoResolveProduct ? autoResolved.productId : productId

  const { data: resolved, isLoading: resolveLoading } = useResolvePolicy(
    { kind: "cancellation", productId: effectiveProductId ?? undefined },
    { enabled: open },
  )

  const policy = resolved?.data
  const evalInput = React.useMemo(() => {
    if (booking.sellAmountCents == null) return null
    return {
      daysBeforeDeparture,
      totalCents: booking.sellAmountCents,
      currency: booking.sellCurrency,
    }
  }, [daysBeforeDeparture, booking.sellAmountCents, booking.sellCurrency])

  const { data: evaluationData, isFetching: evaluationLoading } = useEvaluateCancellation(
    policy?.policy.id ?? null,
    evalInput,
    { enabled: open && Boolean(policy) },
  )
  const evaluation = evaluationData?.data ?? null

  const cancelMutation = useBookingCancelMutation(booking.id)

  React.useEffect(() => {
    if (!open) {
      setReason("")
    }
  }, [open])

  const handleConfirm = async () => {
    if (!reason.trim()) return
    await cancelMutation.mutateAsync({ note: reason.trim() })
    onOpenChange(false)
    onSuccess?.()
  }

  const total = booking.sellAmountCents
  const refund = evaluation?.refundCents ?? 0
  const penalty = total != null ? Math.max(0, total - refund) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Cancel Booking
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {/* Booking summary */}
          <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Booking</div>
              <div className="font-mono text-xs">{booking.bookingNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Start date</div>
              <div>{booking.startDate ?? "TBD"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-mono">
                {total != null ? formatAmount(total, booking.sellCurrency) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Days before departure</div>
              <div>{daysBeforeDeparture}</div>
            </div>
          </div>

          {/* Policy + refund preview */}
          {resolveLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Resolving cancellation policy...
            </div>
          ) : !policy ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No cancellation policy configured for this booking. Proceeding will cancel without a
              refund preview.
            </div>
          ) : (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Applicable policy</div>
                  <div className="text-sm font-medium">{policy.policy.name}</div>
                </div>
                {evaluation && (
                  <Badge variant={refundTypeVariant[evaluation.refundType] ?? "secondary"}>
                    {refundTypeLabel[evaluation.refundType] ?? evaluation.refundType}
                  </Badge>
                )}
              </div>

              {evaluationLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating refund...
                </div>
              ) : evaluation && total != null ? (
                <div className="grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Refund</div>
                    <div className="font-mono font-medium">
                      {formatAmount(evaluation.refundCents, booking.sellCurrency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({formatPercent(evaluation.refundPercent)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Penalty</div>
                    <div className="font-mono font-medium text-destructive">
                      {formatAmount(penalty, booking.sellCurrency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rule</div>
                    <div className="text-xs">
                      {evaluation.appliedRule?.label ??
                        (evaluation.appliedRule?.daysBeforeDeparture != null
                          ? `≥ ${evaluation.appliedRule.daysBeforeDeparture} days`
                          : "—")}
                    </div>
                  </div>
                </div>
              ) : total == null ? (
                <p className="border-t pt-3 text-sm text-muted-foreground">
                  Booking has no total amount — refund cannot be calculated.
                </p>
              ) : null}
            </div>
          )}

          {/* Reason */}
          <div className="flex flex-col gap-2">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this booking being cancelled?"
              required
            />
          </div>

          {cancelMutation.error && (
            <p className="text-xs text-destructive">
              {cancelMutation.error instanceof Error
                ? cancelMutation.error.message
                : "Cancellation failed"}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!reason.trim() || cancelMutation.isPending}
          >
            {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
