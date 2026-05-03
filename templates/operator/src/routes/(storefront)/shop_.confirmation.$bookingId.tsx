import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { useEffect, useState } from "react"
import { z } from "zod"

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
})

interface BankTransferStash {
  kind: "bank_transfer_instructions"
  bookingId: string
  proformaNumber: string | null
  instructions: {
    beneficiary: string
    iban: string
    bankName: string
    reference: string
    amountCents: number
    currency: string
    dueAt: string
  }
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
        <CardPendingPanel bookingId={bookingId} />
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
        {stash ? (
          <dl className="space-y-2 rounded border bg-muted/30 p-4">
            <Row label="Booking reference" value={bookingId} />
            {stash.proformaNumber ? (
              <Row label="Proforma number" value={stash.proformaNumber} />
            ) : null}
            <Row label="Beneficiary" value={stash.instructions.beneficiary} />
            <Row label="Bank" value={stash.instructions.bankName} />
            <Row label="IBAN" value={stash.instructions.iban} />
            <Row label="Reference" value={stash.instructions.reference} />
            <Row
              label="Amount"
              value={formatMoney(stash.instructions.amountCents, stash.instructions.currency)}
            />
            <Row label="Due by" value={stash.instructions.dueAt} />
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

function CardPendingPanel({ bookingId }: { bookingId: string }): React.ReactElement {
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
