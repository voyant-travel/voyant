import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { useEffect, useState } from "react"
import { z } from "zod"
import { getApiUrl } from "@/lib/env"

/**
 * Post-checkout confirmation page for the storefront flow.
 *
 * Renders one of four panels keyed off `?kind=`:
 *
 *   - `card_pending`  — "we're processing your card payment"
 *   - `bank_transfer` — proforma + IBAN/reference instructions,
 *                        pulled from sessionStorage where the
 *                        storefront wrapper stashed them.
 *   - `inquiry`        — "we'll get back to you" thanks page
 *   - `hold`           — "we've placed a hold" (operator brokered)
 *   - default          — generic confirmation when no kind is set
 *
 * Phase 6: poll the booking status and surface contract / invoice
 * download links once the workflow finishes.
 */

const confirmationSearchSchema = z.object({
  kind: z.enum(["card_pending", "bank_transfer", "inquiry", "hold"]).optional(),
  session: z.string().optional(),
  orderId: z.string().optional(),
  ref: z.string().optional(),
})

interface BankTransferStash {
  kind: "bank_transfer_instructions"
  bookingId: string
  proformaNumber: string | null
  instructions: BankTransferInstructions
}

interface BankTransferInstructions {
  beneficiary: string
  iban: string
  bankName: string
  reference: string
  amountCents: number
  currency: string
  dueAt: string | null
}

export const Route = createFileRoute("/(storefront)/shop_/confirmation/$bookingId")({
  component: ShopConfirmationRouteComponent,
  validateSearch: confirmationSearchSchema,
})

function ShopConfirmationRouteComponent(): React.ReactElement {
  const { bookingId } = useParams({ from: "/(storefront)/shop_/confirmation/$bookingId" })
  const search = useSearch({ from: "/(storefront)/shop_/confirmation/$bookingId" })
  const kind = search.kind ?? "default"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {kind === "bank_transfer" ? (
        <BankTransferPanel bookingId={bookingId} />
      ) : kind === "card_pending" ? (
        <CardPendingPanel
          bookingId={bookingId}
          paymentRef={search.session ?? search.orderId ?? search.ref}
        />
      ) : kind === "inquiry" ? (
        <InquiryPanel bookingId={bookingId} />
      ) : kind === "hold" ? (
        <HoldPanel bookingId={bookingId} />
      ) : (
        <DefaultPanel bookingId={bookingId} />
      )}
      <BackLink />
    </div>
  )
}

function BankTransferPanel({ bookingId }: { bookingId: string }): React.ReactElement {
  const [stash, setStash] = useState<BankTransferStash | null>(null)
  const status = useCheckoutStatus(bookingId)
  const liveInstructions = status?.bankTransferInstructions ?? null
  const instructions = liveInstructions ?? stash?.instructions ?? null
  const proformaNumber = liveInstructions?.proformaNumber ?? stash?.proformaNumber ?? null

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return
    const raw = sessionStorage.getItem(`voyant.checkout.${bookingId}`)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as BankTransferStash
      if (parsed.kind === "bank_transfer_instructions") setStash(parsed)
    } catch {
      // Bad stash — ignore.
    }
  }, [bookingId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservation pending bank transfer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          Your reservation is held while we wait for your payment to land. Use the details below
          when you initiate the bank transfer — please include the reference exactly so we can match
          the payment to your booking.
        </p>
        {instructions ? (
          <dl className="space-y-2 rounded border bg-muted/30 p-4">
            <Row label="Booking reference" value={bookingId} />
            {proformaNumber ? <Row label="Proforma number" value={proformaNumber} /> : null}
            <Row label="Beneficiary" value={instructions.beneficiary} />
            <Row label="Bank" value={instructions.bankName} />
            <Row label="IBAN" value={instructions.iban} />
            <Row label="Reference" value={instructions.reference} />
            <Row
              label="Amount"
              value={formatMoney(instructions.amountCents, instructions.currency)}
            />
            {instructions.dueAt ? <Row label="Due by" value={instructions.dueAt} /> : null}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Your bank-transfer instructions were also emailed to you. Check your inbox.
          </p>
        )}
        <p className="text-muted-foreground">
          Once we receive the payment we'll generate your final invoice and contract automatically
          and email them through.
        </p>
      </CardContent>
    </Card>
  )
}

interface CheckoutStatus {
  bookingId: string
  bookingNumber: string
  bookingStatus: string
  paymentStatus: "paid" | "pending" | "failed"
  session: {
    id: string
    status: string
    amountCents: number
    currency: string
    completedAt: string | null
  } | null
  bankTransferInstructions: (BankTransferInstructions & { proformaNumber: string | null }) | null
}

function CardPendingPanel({
  bookingId,
  paymentRef,
}: {
  bookingId: string
  paymentRef?: string
}): React.ReactElement {
  const status = useCheckoutStatus(bookingId, paymentRef)

  if (status?.paymentStatus === "paid") {
    return <PaymentSuccessPanel bookingId={bookingId} status={status} />
  }

  if (status?.paymentStatus === "failed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment not completed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Booking reference: <code>{status.bookingNumber || bookingId}</code>
          </p>
          <p className="text-muted-foreground">
            The card processor did not confirm this payment. If money left your account, contact us
            with the booking reference so we can reconcile it.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing your payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Booking reference: <code>{bookingId}</code>
        </p>
        <p className="text-muted-foreground">
          We're waiting for the card processor to confirm your payment. This page will update once
          we hear back — usually within a minute. You can also close this tab; we'll email you the
          contract and invoice once the booking is confirmed.
        </p>
      </CardContent>
    </Card>
  )
}

function PaymentSuccessPanel({
  bookingId,
  status,
}: {
  bookingId: string
  status: CheckoutStatus
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thank you — your booking is confirmed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Booking reference: <code>{status.bookingNumber || bookingId}</code>
        </p>
        {status.session ? (
          <p>
            Payment received:{" "}
            <strong>{formatMoney(status.session.amountCents, status.session.currency)}</strong>
          </p>
        ) : null}
        <p className="text-muted-foreground">
          We'll email your contract and invoice shortly. You can safely close this tab.
        </p>
      </CardContent>
    </Card>
  )
}

function useCheckoutStatus(bookingId: string, paymentRef?: string): CheckoutStatus | null {
  const [status, setStatus] = useState<CheckoutStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined

    const poll = async () => {
      const url = new URL(
        `${getApiUrl()}/v1/public/bookings/${encodeURIComponent(bookingId)}/checkout-status`,
      )
      if (paymentRef) url.searchParams.set("ref", paymentRef)
      try {
        const res = await fetch(url, { credentials: "include" })
        if (res.ok) {
          const json = (await res.json()) as { data?: CheckoutStatus }
          if (!cancelled && json.data) {
            setStatus(json.data)
            if (json.data.paymentStatus !== "pending") return
          }
        }
      } catch {
        // Keep polling; transient local/dev errors should not pin the page forever.
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 3000)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [bookingId, paymentRef])

  return status
}

function InquiryPanel({ bookingId }: { bookingId: string }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inquiry received</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Thanks — we've got your details and will reach out with availability and a quote.</p>
        <p className="text-muted-foreground">
          Reference: <code>{bookingId}</code>
        </p>
      </CardContent>
    </Card>
  )
}

function HoldPanel({ bookingId }: { bookingId: string }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking on hold</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Booking reference: <code>{bookingId}</code>
        </p>
        <p className="text-muted-foreground">
          We've placed a hold on your reservation. Our team will reach out to confirm the next
          steps.
        </p>
      </CardContent>
    </Card>
  )
}

function DefaultPanel({ bookingId }: { bookingId: string }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking confirmed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Booking reference: <code>{bookingId}</code>
        </p>
        <p className="text-muted-foreground text-sm">
          We've placed a hold on your reservation. You'll receive a confirmation email shortly with
          the next steps.
        </p>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  )
}

function BackLink(): React.ReactElement {
  return (
    <Link
      to="/shop"
      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
    >
      Back to storefront
    </Link>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
