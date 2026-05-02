"use client"

import type { PublicPaymentSession } from "@voyantjs/finance/public-validation"
import { Button } from "@voyantjs/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { type ReactNode, useState } from "react"

interface StartCardResponse {
  data?: { redirectUrl: string | null }
  error?: string
}

/**
 * Universal landing page rendered at `/pay/:sessionId`. The customer lands
 * here from a payment-link email (or after returning from the processor's
 * hosted checkout). Vertical-agnostic — same component for a flight order,
 * a hotel deposit, or a cruise balance.
 *
 * The parent owns:
 *   - fetching `PublicPaymentSession` from `/v1/public/payment-sessions/:id`
 *     (typically via `usePublicPaymentSession` from `@voyantjs/finance-react`)
 *   - re-fetching after the user returns from the processor (the processor
 *     redirects back to `session.returnUrl`; the page re-mounts and the
 *     latest status is shown)
 *   - sourcing the bank-transfer block from template config
 *
 * See `docs/architecture/payments-architecture.md` §Core Rule 4.
 */
export interface PaymentLinkLandingPageProps {
  session: PublicPaymentSession
  /** Bank-transfer instructions block — template-supplied per deployment. */
  bankTransferInstructions?: BankTransferInstructions
  /** Header slot (logo, brand name, optional support contact). */
  brandHeader?: ReactNode
  /** Footer slot (T&Cs link, support contact, privacy). */
  brandFooter?: ReactNode
  /**
   * Fired when the customer clicks "Pay by card" — the parent typically
   * redirects to `session.redirectUrl` (the processor's hosted checkout).
   */
  onPayByCard?: () => void
  /**
   * Optional human-readable description shown above the amount. Sourced
   * from the booking / invoice / vertical context (the session record
   * itself doesn't carry a description today).
   */
  description?: string
  /**
   * Fired when the customer clicks "Try again" on a failed payment.
   * Should create a fresh `payment_session` (the original one is dead)
   * and redirect the customer to its landing page. The parent typically
   * POSTs to `/v1/public/payment-link/:sessionId/retry` and navigates to
   * `/pay/{newSessionId}` with the result. When omitted, the failed
   * panel renders no retry CTA at all (clearer than a button that
   * re-opens the dead processor URL).
   */
  onRetry?: () => Promise<void> | void
}

export interface BankTransferInstructions {
  beneficiaryName: string
  iban: string
  bic?: string
  bankName?: string
  /**
   * Reference the customer must include in their wire so finance can
   * reconcile the inbound transfer. Defaults to the session's
   * `externalReference` / `clientReference` / `id` when not supplied.
   */
  reference?: string
  /** Free-text notes — surfaced under the IBAN block. */
  notes?: string
}

export function PaymentLinkLandingPage({
  session,
  bankTransferInstructions,
  brandHeader,
  brandFooter,
  onPayByCard,
  onRetry,
  description,
}: PaymentLinkLandingPageProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      {brandHeader}
      <Header session={session} description={description} />
      <Body
        session={session}
        bankTransferInstructions={bankTransferInstructions}
        onPayByCard={onPayByCard}
        onRetry={onRetry}
      />
      {brandFooter}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Header({ session, description }: { session: PublicPaymentSession; description?: string }) {
  return (
    <header className="flex flex-col gap-2 border-b pb-4">
      <h1 className="font-semibold text-2xl">{description ?? defaultDescription(session)}</h1>
      {session.notes && <p className="text-muted-foreground text-sm">{session.notes}</p>}
      <div className="flex items-baseline gap-3">
        <span className="font-semibold text-3xl tabular-nums">
          {formatMoneyCents(session.amountCents, session.currency)}
        </span>
        {session.expiresAt && session.status !== "paid" && (
          <span className="text-muted-foreground text-sm">
            Expires {formatDateTime(session.expiresAt)}
          </span>
        )}
      </div>
    </header>
  )
}

function Body({
  session,
  bankTransferInstructions,
  onPayByCard,
  onRetry,
}: {
  session: PublicPaymentSession
  bankTransferInstructions?: BankTransferInstructions
  onPayByCard?: () => void
  onRetry?: () => Promise<void> | void
}) {
  // Terminal states — short-circuit body to a status panel.
  if (session.status === "paid") return <TerminalState status="paid" reason={null} />
  if (session.status === "failed") {
    return (
      <TerminalState status="failed" reason={session.failureMessage ?? null} onRetry={onRetry} />
    )
  }
  if (session.status === "expired") return <TerminalState status="expired" reason={null} />
  if (session.status === "cancelled") return <TerminalState status="cancelled" reason={null} />
  if (session.status === "processing" || session.status === "authorized") {
    return <ProcessingState />
  }

  const cardAvailable =
    Boolean(session.redirectUrl) ||
    Boolean(session.provider) ||
    session.status === "requires_redirect"
  const bankAvailable = Boolean(bankTransferInstructions)

  // No method available — soft fallback (rare; signals a misconfigured
  // session that has neither a redirect URL nor a bank-transfer block).
  if (!cardAvailable && !bankAvailable) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
        <p className="font-medium">No payment method available</p>
        <p className="mt-2 text-muted-foreground">
          This payment link doesn't have any payment methods configured. Please contact your travel
          agent.
        </p>
      </div>
    )
  }

  // Single method — render inline without tabs.
  if (cardAvailable && !bankAvailable) {
    return <CardPanel session={session} onPayByCard={onPayByCard} />
  }
  if (bankAvailable && !cardAvailable && bankTransferInstructions) {
    return <BankTransferPanel session={session} instructions={bankTransferInstructions} />
  }

  // Both methods — tab strip.
  return (
    <Tabs defaultValue="card" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="card">
          <CreditCard className="mr-2 h-4 w-4" />
          Pay by card
        </TabsTrigger>
        <TabsTrigger value="bank">
          <Building2 className="mr-2 h-4 w-4" />
          Bank transfer
        </TabsTrigger>
      </TabsList>
      <TabsContent value="card" className="mt-4">
        <CardPanel session={session} onPayByCard={onPayByCard} />
      </TabsContent>
      <TabsContent value="bank" className="mt-4">
        {bankTransferInstructions && (
          <BankTransferPanel session={session} instructions={bankTransferInstructions} />
        )}
      </TabsContent>
    </Tabs>
  )
}

function CardPanel({
  session,
  onPayByCard,
}: {
  session: PublicPaymentSession
  onPayByCard?: () => void
}) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (onPayByCard) {
      onPayByCard()
      return
    }
    if (session.redirectUrl) {
      window.location.href = session.redirectUrl
      return
    }
    // Lazy-start the configured processor. The template exposes a public
    // endpoint that calls e.g. `netopia.startPaymentSession` on demand and
    // returns the redirect URL.
    setStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/public/payment-link/${session.id}/start-card`, {
        method: "POST",
        headers: { Accept: "application/json" },
      })
      const body = (await res.json()) as StartCardResponse
      if (!res.ok || !body.data?.redirectUrl) {
        throw new Error(body.error ?? "Card payment couldn't be prepared.")
      }
      window.location.href = body.data.redirectUrl
    } catch (err) {
      setError((err as Error).message)
      setStarting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="mb-4 text-muted-foreground text-sm">
        You'll be redirected to the secure payment page hosted by the card processor.
      </p>
      <Button className="w-full" disabled={starting} onClick={handleClick}>
        {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Pay {formatMoneyCents(session.amountCents, session.currency)}
        {!starting && <ExternalLink className="ml-2 h-4 w-4" />}
      </Button>
      {error && (
        <p className="mt-3 text-destructive text-xs">
          {error} If the issue persists, please pay by bank transfer or contact your travel agent.
        </p>
      )}
    </div>
  )
}

function BankTransferPanel({
  session,
  instructions,
}: {
  session: PublicPaymentSession
  instructions: BankTransferInstructions
}) {
  const reference =
    instructions.reference ?? session.externalReference ?? session.clientReference ?? session.id
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="mb-4 text-muted-foreground text-sm">
        Wire {formatMoneyCents(session.amountCents, session.currency)} to the account below. Your
        booking is confirmed once payment is received (typically 1–3 business days).
      </p>
      <dl className="grid grid-cols-1 gap-2 text-sm">
        <Row label="Beneficiary">{instructions.beneficiaryName}</Row>
        <Row label="IBAN" copyValue={instructions.iban}>
          <span className="font-mono">{instructions.iban}</span>
        </Row>
        {instructions.bic && (
          <Row label="BIC / SWIFT" copyValue={instructions.bic}>
            <span className="font-mono">{instructions.bic}</span>
          </Row>
        )}
        {instructions.bankName && <Row label="Bank">{instructions.bankName}</Row>}
        <Row label="Reference" copyValue={reference}>
          <span className="font-mono">{reference}</span>
        </Row>
      </dl>
      {instructions.notes && (
        <p className="mt-4 text-muted-foreground text-xs">{instructions.notes}</p>
      )}
    </div>
  )
}

function Row({
  label,
  children,
  copyValue,
}: {
  label: string
  children: ReactNode
  copyValue?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">{label}</dt>
      <dd className="flex items-center gap-2">
        {children}
        {copyValue && <CopyButton value={copyValue} />}
      </dd>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : `Copy ${value}`}
      className="text-muted-foreground transition-colors hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Older browsers without clipboard API — no-op; the value is still
          // visible and selectable for manual copy.
        }
      }}
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function TerminalState({
  status,
  reason,
  onRetry,
}: {
  status: "paid" | "failed" | "expired" | "cancelled"
  reason: string | null
  onRetry?: () => Promise<void> | void
}) {
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const cfg = {
    paid: {
      icon: <CheckCircle2 className="h-10 w-10 text-emerald-600" />,
      title: "Payment received",
      body: "Thanks — your booking is confirmed. You'll receive a confirmation email shortly.",
      tone: "border-emerald-500/40 bg-emerald-500/5",
    },
    failed: {
      icon: <CircleAlert className="h-10 w-10 text-destructive" />,
      title: "Payment failed",
      body: reason ?? "The payment couldn't be processed. Please try again or contact support.",
      tone: "border-destructive/40 bg-destructive/5",
    },
    expired: {
      icon: <CircleAlert className="h-10 w-10 text-amber-600" />,
      title: "Payment link expired",
      body: "This payment link has expired. Please request a new one from your travel agent.",
      tone: "border-amber-500/40 bg-amber-500/5",
    },
    cancelled: {
      icon: <CircleAlert className="h-10 w-10 text-muted-foreground" />,
      title: "Payment cancelled",
      body: "This payment was cancelled. Please contact your travel agent if this is unexpected.",
      tone: "border-border bg-muted/20",
    },
  }[status]

  return (
    <div
      className={cn("flex flex-col items-center gap-3 rounded-xl border p-8 text-center", cfg.tone)}
    >
      {cfg.icon}
      <h2 className="font-semibold text-lg">{cfg.title}</h2>
      <p className="max-w-md text-muted-foreground text-sm">{cfg.body}</p>
      {status === "failed" && onRetry && (
        <>
          <Button
            className="mt-2"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true)
              setRetryError(null)
              try {
                await onRetry()
              } catch (err) {
                setRetryError((err as Error).message)
                setRetrying(false)
              }
            }}
          >
            {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try again
          </Button>
          {retryError && <p className="text-destructive text-xs">{retryError}</p>}
        </>
      )}
    </div>
  )
}

function ProcessingState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      <h2 className="font-semibold text-lg">Processing payment…</h2>
      <p className="max-w-md text-muted-foreground text-sm">
        We're confirming the payment with the processor. This usually takes a few seconds.
      </p>
    </div>
  )
}

function defaultDescription(session: PublicPaymentSession): string {
  switch (session.targetType) {
    case "booking":
      return "Booking payment"
    case "booking_payment_schedule":
      return "Booking deposit"
    case "booking_guarantee":
      return "Booking guarantee"
    case "invoice":
      return "Invoice payment"
    case "order":
      return "Order payment"
    case "flight_order":
      return "Flight payment"
    default:
      return "Payment"
  }
}

function formatMoneyCents(cents: number, currency: string): string {
  const amount = cents / 100
  if (!Number.isFinite(amount)) return `${cents} ${currency}`
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}
