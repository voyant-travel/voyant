"use client"

import type { InitiatedCheckoutCollectionRecord } from "@voyantjs/checkout"
import { type PaymentChoice, useCollectPayment } from "@voyantjs/checkout-react"
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
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useCheckoutUiMessagesOrDefault } from "../i18n/provider.js"
import { PaymentStep } from "./payment-step.js"

/**
 * Operator-side "Collect payment" dialog. Wraps `<PaymentStep>` and
 * `useCollectPayment` so any vertical's booking detail page can drop it in:
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
 *
 * Capabilities are pinned to `sendLink + bankTransfer` because the
 * operator initiates the collection rather than the customer self-charging
 * a saved card. Verticals that need additional flows (e.g. a "Charge to
 * folio" extra) should compose `<PaymentStep>` directly.
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

/**
 * Operator dialog defaults to immediate-charge disabled. Templates that
 * have wired a processor with stored-token support can override via
 * `<PaymentStep>` directly; this dialog is the simple "produce a link to
 * share" flow.
 */
const CAPABILITIES = {
  chargeSavedCard: false,
  newCard: false,
}

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
  const [choice, setChoice] = useState<PaymentChoice | null>(null)
  const [result, setResult] = useState<InitiatedCheckoutCollectionRecord | null>(null)

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

  function reset() {
    setAmountCents(defaultAmountCents ?? 0)
    setChoice(null)
    setResult(null)
    collect.reset()
  }

  async function submit() {
    if (!choice || choice.type !== "hold") {
      toast.error(messages.validation.pickHold)
      return
    }
    if (amountCents <= 0) {
      toast.error(messages.validation.amountAboveZero)
      return
    }
    try {
      const data = await collect.mutateAsync({ choice, amountCents })
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
                  const raw = Number.parseFloat(e.target.value)
                  setAmountCents(Number.isFinite(raw) ? Math.round(raw * 100) : 0)
                }}
              />
              <p className="text-muted-foreground text-xs">{messages.amountHelp}</p>
            </div>

            <PaymentStep value={choice} onChange={setChoice} capabilities={CAPABILITIES} />
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
              <Button onClick={submit} disabled={collect.isPending || choice?.type !== "hold"}>
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

function ResultPanel({ result }: { result: InitiatedCheckoutCollectionRecord }) {
  const messages = useCheckoutUiMessagesOrDefault().collectPaymentDialog
  const sessionId = result.paymentSession?.id ?? null
  const landingUrl =
    sessionId && typeof window !== "undefined" ? `${window.location.origin}/pay/${sessionId}` : null

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
