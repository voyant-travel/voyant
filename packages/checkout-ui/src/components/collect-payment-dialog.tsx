"use client"

import type { InitiatedCheckoutCollectionRecord } from "@voyantjs/checkout"
import { useCheckoutPaymentLinkConfig, useCollectPayment } from "@voyantjs/checkout-react"
import { buildPaymentLinkUrl } from "@voyantjs/finance/payment-link"
import {
  type BookingPaymentScheduleRecord,
  useBookingPaymentSchedules,
} from "@voyantjs/finance-react"
import { formatMessage } from "@voyantjs/i18n"
import { Button } from "@voyantjs/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { useCheckoutUiMessagesOrDefault } from "../i18n/provider.js"

/**
 * Operator-side "Generate payment link" dialog. Bookings created via
 * the new booking flow already land in `on_hold`, so the dialog skips
 * the choose-flow step and goes straight to producing a link the
 * operator can share. Optionally pre-fills the amount from a payment
 * schedule (deposit / balance / etc.) when the booking has any.
 *
 * ```tsx
 * <CollectPaymentDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   bookingId={booking.id}
 *   defaultCurrency={booking.sellCurrency}
 *   defaultAmountCents={booking.sellAmountCents}
 * />
 * ```
 */
export interface CollectPaymentDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  bookingId: string
  defaultCurrency: string
  defaultAmountCents?: number | null
  defaultPayerEmail?: string | null
  defaultPayerName?: string | null
  /**
   * Language for the processor's hosted payment page. Pass the picked
   * person's `preferredLanguage`, the booking locale, or the active admin
   * locale. Falls back to the processor's deploy-wide default when omitted.
   */
  defaultPayerLanguage?: string | null
  /**
   * Per-session overrides for where the customer's browser lands after
   * payment success / cancel on the processor's hosted page. Storefront
   * flows usually pass their own confirmation route; operator-initiated
   * send-link flows usually leave these unset and let the deploy-wide
   * `NETOPIA_REDIRECT_URL` point at the public `/pay/:sessionId` landing.
   */
  returnUrl?: string | null
  cancelUrl?: string | null
  /** Card processor id registered in checkout's `paymentStarters`. */
  cardProvider?: string
}

const FULL_AMOUNT_VALUE = "__full__"

export function CollectPaymentDialog({
  open,
  onOpenChange,
  bookingId,
  defaultCurrency,
  defaultAmountCents,
  defaultPayerEmail,
  defaultPayerName,
  defaultPayerLanguage,
  returnUrl,
  cancelUrl,
  cardProvider,
}: CollectPaymentDialogProps) {
  const messages = useCheckoutUiMessagesOrDefault().collectPaymentDialog
  const [amountCents, setAmountCents] = useState<number>(defaultAmountCents ?? 0)
  const [scheduleId, setScheduleId] = useState<string>(FULL_AMOUNT_VALUE)
  const [result, setResult] = useState<InitiatedCheckoutCollectionRecord | null>(null)

  const schedulesQuery = useBookingPaymentSchedules(bookingId, { enabled: open })
  // Only the open schedules are useful pre-fills. Paid / waived /
  // cancelled / expired wouldn't represent money the customer still
  // needs to send.
  const schedules = useMemo(
    () =>
      (schedulesQuery.data?.data ?? []).filter((s) => s.status === "pending" || s.status === "due"),
    [schedulesQuery.data?.data],
  )

  const collect = useCollectPayment(bookingId, {
    cardProvider,
    payerEmail: defaultPayerEmail,
    payerName: defaultPayerName,
    payerLanguage: defaultPayerLanguage,
    returnUrl,
    cancelUrl,
  })

  const amountInputValue = useMemo(
    () => (amountCents > 0 ? (amountCents / 100).toFixed(2) : ""),
    [amountCents],
  )

  // Re-seed the amount from the latest props only on the closed→open
  // transition. Watching state mid-flight would clobber manual edits.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setAmountCents(defaultAmountCents ?? 0)
      setScheduleId(FULL_AMOUNT_VALUE)
    }
    wasOpenRef.current = open
  }, [open, defaultAmountCents])

  function reset() {
    setAmountCents(defaultAmountCents ?? 0)
    setScheduleId(FULL_AMOUNT_VALUE)
    setResult(null)
    collect.reset()
  }

  async function submit() {
    if (amountCents <= 0) {
      toast.error(messages.validation.amountAboveZero)
      return
    }
    try {
      const data = await collect.mutateAsync({ choice: { type: "hold" }, amountCents })
      setResult(data)
      toast.success(messages.validation.linkReady)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
          <DialogDescription>{messages.description}</DialogDescription>
        </DialogHeader>

        {result ? (
          <ResultPanel result={result} />
        ) : (
          <div className="flex flex-col gap-5">
            {schedules.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="collect-schedule">{messages.scheduleLabel}</Label>
                <Select
                  value={scheduleId}
                  onValueChange={(v) => {
                    const next = v ?? FULL_AMOUNT_VALUE
                    setScheduleId(next)
                    if (next === FULL_AMOUNT_VALUE) {
                      setAmountCents(defaultAmountCents ?? 0)
                    } else {
                      const schedule = schedules.find((s) => s.id === next)
                      if (schedule) setAmountCents(schedule.amountCents)
                    }
                  }}
                >
                  <SelectTrigger id="collect-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FULL_AMOUNT_VALUE}>
                      {formatMessage(messages.scheduleFullAmount, {
                        amount: formatAmount(defaultAmountCents ?? 0, defaultCurrency),
                      })}
                    </SelectItem>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {formatScheduleOption(schedule, messages.scheduleTypeLabels)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{messages.scheduleHelp}</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="collect-amount">
                {formatMessage(messages.amountLabel, { currency: defaultCurrency })}
              </Label>
              <Input
                id="collect-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amountInputValue}
                onChange={(e) => {
                  // Manual edit detaches the amount from the picked
                  // schedule so the user can charge a custom amount.
                  setScheduleId(FULL_AMOUNT_VALUE)
                  const raw = Number.parseFloat(e.target.value)
                  setAmountCents(Number.isFinite(raw) ? Math.round(raw * 100) : 0)
                }}
              />
              <p className="text-muted-foreground text-xs">{messages.amountHelp}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{messages.done}</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={collect.isPending}
              >
                {messages.cancel}
              </Button>
              <Button onClick={submit} disabled={collect.isPending || amountCents <= 0}>
                {collect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {messages.generateLink}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatAmount(cents: number, currency: string): string {
  if (cents <= 0) return `0 ${currency}`
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function formatScheduleOption(
  schedule: BookingPaymentScheduleRecord,
  typeLabels: Record<string, string>,
): string {
  const typeLabel = typeLabels[schedule.scheduleType] ?? schedule.scheduleType
  const amount = formatAmount(schedule.amountCents, schedule.currency)
  return `${typeLabel} • ${amount} • ${schedule.dueDate}`
}

function ResultPanel({ result }: { result: InitiatedCheckoutCollectionRecord }) {
  const messages = useCheckoutUiMessagesOrDefault().collectPaymentDialog
  const configQuery = useCheckoutPaymentLinkConfig()
  const sessionId = result.paymentSession?.id ?? null
  const landingUrl =
    sessionId && typeof window !== "undefined"
      ? buildPaymentLinkUrl(sessionId, {
          baseUrl: configQuery.data?.publicCheckoutBaseUrl ?? window.location.origin,
        })
      : null

  if (!landingUrl) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
        {formatMessage(messages.result.noLink, {
          sessionId: sessionId ?? messages.result.noSession,
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">{messages.result.ready}</span>
      </div>
      <p className="text-muted-foreground text-sm">{messages.result.body}</p>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 font-mono text-xs">
        <span className="flex-1 break-all">{landingUrl}</span>
        <button
          type="button"
          aria-label={messages.result.copyLink}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            navigator.clipboard?.writeText(landingUrl).catch(() => undefined)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={landingUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={messages.result.openLink}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
