"use client"

import { useNavigate } from "@tanstack/react-router"
import {
  useAirlines,
  useAirports,
  useFlightOrder,
  useFlightOrderCancel,
} from "@voyantjs/flights-react"
import { FlightOrderConfirmation } from "@voyantjs/flights-ui"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { CheckCircle2, ChevronLeft, Copy, ExternalLink, Plane } from "lucide-react"
import { useState } from "react"

import { Route } from "@/routes/_workspace/flights_.orders.$orderId"

export function FlightOrderPage() {
  const navigate = useNavigate()
  const { orderId } = Route.useParams()
  const orderQuery = useFlightOrder(orderId)
  const cancelMutation = useFlightOrderCancel()

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierName = (code: string) =>
    airlinesQuery.data?.data.find((a) => a.iataCode === code)?.name
  const airportName = (code: string) => {
    const a = airportsQuery.data?.data.find((x) => x.iataCode === code)
    return a ? `${a.city} (${a.iataCode})` : undefined
  }

  if (orderQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="h-64 animate-pulse rounded-xl border bg-muted/20" />
      </div>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    const message =
      orderQuery.error instanceof Error ? orderQuery.error.message : "Order not found."
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <Plane className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-medium text-base">Order not available</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">{message}</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/flights" })}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to flight search
          </Button>
        </div>
      </div>
    )
  }

  const order = orderQuery.data.order
  const paymentStatus =
    typeof order.providerData?.paymentStatus === "string"
      ? (order.providerData.paymentStatus as PaymentSessionStatus)
      : null

  return (
    <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-6 px-6 py-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-2xl">Booking</h1>
            {paymentStatus && <PaymentStatusBadge status={paymentStatus} />}
          </div>
          <p className="text-muted-foreground text-sm">Order confirmation and itinerary.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/flights" })}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to flight search
        </Button>
      </header>

      <PaymentLinkPanel order={order} paymentStatus={paymentStatus} />

      <FlightOrderConfirmation
        order={order}
        carrierName={carrierName}
        airportName={airportName}
        onCancel={(o) => cancelMutation.mutate({ orderId: o.orderId })}
        cancelLoading={cancelMutation.isPending}
      />
    </div>
  )
}

type PaymentSessionStatus =
  | "pending"
  | "requires_redirect"
  | "processing"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"

const PAYMENT_BADGE: Record<
  PaymentSessionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Payment pending", variant: "outline" },
  requires_redirect: { label: "Awaiting card", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  authorized: { label: "Authorized", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  failed: { label: "Payment failed", variant: "destructive" },
  cancelled: { label: "Payment cancelled", variant: "outline" },
  expired: { label: "Payment expired", variant: "outline" },
}

function PaymentStatusBadge({ status }: { status: PaymentSessionStatus }) {
  const cfg = PAYMENT_BADGE[status] ?? { label: status, variant: "outline" as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

/**
 * Renders the shareable payment-link block for hold-state orders. The
 * server (`templates/operator/src/api/flights.ts`) ensures a finance
 * payment_session exists with `clientReference = orderId` and stuffs the
 * session id into `order.providerData.paymentSessionId`. The link itself
 * is the universal landing route — `/pay/$sessionId` — where the customer
 * picks card or bank transfer.
 */
function PaymentLinkPanel({
  order,
  paymentStatus,
}: {
  order: { providerData?: Record<string, unknown> | undefined }
  paymentStatus: PaymentSessionStatus | null
}) {
  const sessionId =
    typeof order.providerData?.paymentSessionId === "string"
      ? order.providerData.paymentSessionId
      : null

  if (!sessionId) return null
  // Once the customer has paid, the shareable link is no longer useful —
  // the badge in the header is the operator's signal that all is well.
  if (paymentStatus === "paid" || paymentStatus === "authorized") return null

  const landingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/pay/${sessionId}` : null
  if (!landingUrl) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium text-sm">Payment link ready</span>
      </div>
      <p className="text-muted-foreground text-sm">
        Share this link with the customer. They'll choose card or bank transfer on the page.
      </p>
      <CopyableUrl url={landingUrl} />
    </div>
  )
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 font-mono text-xs">
      <span className="flex-1 break-all">{url}</span>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy link"}
        className="text-muted-foreground transition-colors hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard?.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // Older browsers — value is still selectable for manual copy.
          }
        }}
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Open link"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
