"use client"

import { useEvaluateCancellation, useResolvePolicy } from "@voyant-travel/legal-react"
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
} from "@voyant-travel/ui/components"
import { AlertTriangle, Loader2 } from "lucide-react"
import * as React from "react"
import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import { type BookingRecord, useBookingCancelMutation, useBookingPrimaryProduct } from "../index.js"

function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
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
   * Amount already paid against the booking, in cents of `booking.sellCurrency`.
   * When present and greater than zero, the dialog makes the finance settlement
   * consequence explicit before cancellation.
   */
  paidAmountCents?: number | null
  /** True when the host knows this booking has at least one recorded payment. */
  hasRecordedPayment?: boolean
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
  paidAmountCents,
  hasRecordedPayment,
  productId,
  onSuccess,
}: BookingCancellationDialogProps) {
  const [reason, setReason] = React.useState("")
  const { formatCurrency, formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

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
  const showPaidSettlementNotice = hasRecordedPayment ?? (paidAmountCents ?? 0) > 0
  const refund = evaluation?.refundCents ?? 0
  const penalty = total != null ? Math.max(0, total - refund) : 0
  const formatAmount = React.useCallback(
    (cents: number, currency: string) => formatCurrency(cents / 100, currency),
    [formatCurrency],
  )
  const formatPercent = React.useCallback(
    (basisPoints: number) =>
      `${formatNumber(basisPoints / 100, {
        maximumFractionDigits: 0,
      })}%`,
    [formatNumber],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {messages.bookingCancellationDialog.title}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {/* Booking summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {messages.bookingCancellationDialog.summary.booking}
              </div>
              <div className="font-mono text-xs">{booking.bookingNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {messages.bookingCancellationDialog.summary.startDate}
              </div>
              <div>
                {booking.startDate ?? messages.bookingCancellationDialog.values.startDateTbd}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {messages.bookingCancellationDialog.summary.total}
              </div>
              <div className="font-mono">
                {total != null
                  ? formatAmount(total, booking.sellCurrency)
                  : messages.bookingCancellationDialog.values.amountUnavailable}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {messages.bookingCancellationDialog.summary.daysBeforeDeparture}
              </div>
              <div>{daysBeforeDeparture}</div>
            </div>
          </div>

          {/* Policy + refund preview */}
          {resolveLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {messages.bookingCancellationDialog.policy.resolving}
            </div>
          ) : !policy ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {messages.bookingCancellationDialog.policy.missing}{" "}
              {messages.bookingCancellationDialog.policy.missingHint}
            </div>
          ) : (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {messages.bookingCancellationDialog.policy.applicablePolicy}
                  </div>
                  <div className="text-sm font-medium">{policy.policy.name}</div>
                </div>
                {evaluation && (
                  <Badge variant={refundTypeVariant[evaluation.refundType] ?? "secondary"}>
                    {messages.bookingCancellationDialog.refundTypeLabels[
                      evaluation.refundType as keyof typeof messages.bookingCancellationDialog.refundTypeLabels
                    ] ?? evaluation.refundType}
                  </Badge>
                )}
              </div>

              {evaluationLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {messages.bookingCancellationDialog.policy.calculating}
                </div>
              ) : evaluation && total != null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t pt-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {messages.bookingCancellationDialog.policy.refund}
                    </div>
                    <div className="font-mono font-medium">
                      {formatAmount(evaluation.refundCents, booking.sellCurrency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({formatPercent(evaluation.refundPercent)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {messages.bookingCancellationDialog.policy.penalty}
                    </div>
                    <div className="font-mono font-medium text-destructive">
                      {formatAmount(penalty, booking.sellCurrency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {messages.bookingCancellationDialog.policy.rule}
                    </div>
                    <div className="text-xs">
                      {evaluation.appliedRule?.label ??
                        (evaluation.appliedRule?.daysBeforeDeparture != null
                          ? formatMessage(
                              messages.bookingCancellationDialog.values.ruleDaysBeforeDeparture,
                              {
                                days: evaluation.appliedRule.daysBeforeDeparture,
                              },
                            )
                          : messages.bookingCancellationDialog.values.ruleFallback)}
                    </div>
                  </div>
                </div>
              ) : total == null ? (
                <p className="border-t pt-3 text-sm text-muted-foreground">
                  {messages.bookingCancellationDialog.policy.noTotalAmount}
                </p>
              ) : null}
            </div>
          )}

          {showPaidSettlementNotice && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium">
                    {messages.bookingCancellationDialog.paidSettlement.title}
                  </div>
                  <p>{messages.bookingCancellationDialog.paidSettlement.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="flex flex-col gap-2">
            <Label>
              {messages.bookingCancellationDialog.fields.reason}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={messages.bookingCancellationDialog.placeholders.reason}
              required
            />
          </div>

          {cancelMutation.error && (
            <p className="text-xs text-destructive">
              {cancelMutation.error instanceof Error
                ? cancelMutation.error.message
                : messages.bookingCancellationDialog.validation.cancellationFailed}
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
            {messages.bookingCancellationDialog.actions.close}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!reason.trim() || cancelMutation.isPending}
          >
            {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.bookingCancellationDialog.actions.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
