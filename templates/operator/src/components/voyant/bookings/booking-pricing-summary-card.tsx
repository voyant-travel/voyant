"use client"

import { useQuery } from "@tanstack/react-query"
import { useInvoices } from "@voyantjs/finance-react"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Receipt } from "lucide-react"

import { api } from "@/lib/api-client"

interface CatalogSnapshotResponse {
  data: {
    pricing_base_amount: string | null
    pricing_taxes: string | null
    pricing_fees: string | null
    pricing_surcharges: string | null
    pricing_currency: string | null
  }
}

/**
 * Pricing breakdown for a booking — subtotal / taxes / fees /
 * surcharges / total. Distinct from the header's "Vânzare 99 EUR"
 * single number, this card answers the question "of those 99 EUR,
 * how much was tax?". Operators reconciling against invoices need
 * this view; the header just doesn't have the room.
 *
 * Source resolution:
 *   1. **Issued invoice** — `invoices.subtotalCents/taxCents/totalCents`.
 *      Authoritative once finalized; tax engines may reclassify lines
 *      that the catalog snapshot priced differently.
 *   2. **Catalog snapshot** — `booking_catalog_snapshot.pricing_*`,
 *      captured at quote time from the upstream provider. Used until
 *      the invoice is issued (e.g. between confirmation and
 *      `issue_invoice` step).
 *   3. **null** — booking has neither; we don't render the card to
 *      avoid showing a misleading "Subtotal 0 / Tax 0".
 */
export function BookingPricingSummaryCard({
  bookingId,
  defaultCurrency,
}: {
  bookingId: string
  /** Fallback currency when neither invoice nor snapshot has one. */
  defaultCurrency: string
}): React.ReactElement | null {
  const { data: invoicesData } = useInvoices({ bookingId, limit: 5 })
  const { data: snapshotData } = useQuery({
    queryKey: ["booking-catalog-snapshot", bookingId],
    queryFn: async () => {
      try {
        return await api.get<CatalogSnapshotResponse>(
          `/v1/admin/bookings/${encodeURIComponent(bookingId)}/catalog-snapshot`,
        )
      } catch (err) {
        if (err instanceof Error && /404/.test(err.message)) return null
        throw err
      }
    },
    staleTime: 60_000,
  })

  // Prefer the most-recent issued (or paid) invoice. Drafts are
  // ignored — they may have placeholder totals that get corrected
  // when issued. Credit notes are also ignored (they offset the
  // base invoice rather than represent the booking's primary
  // pricing breakdown).
  const invoice = (invoicesData?.data ?? []).find((inv) => {
    const type = (inv as { invoiceType?: string }).invoiceType ?? "invoice"
    return type !== "credit_note" && inv.status !== "draft"
  })

  let subtotalCents: number | null = null
  let taxCents: number | null = null
  let feesCents: number | null = null
  let surchargesCents: number | null = null
  let totalCents: number | null = null
  let currency = defaultCurrency
  let source: "invoice" | "snapshot" | null = null
  let invoiceLabel: string | null = null

  if (invoice) {
    subtotalCents = invoice.subtotalCents
    taxCents = invoice.taxCents
    totalCents = invoice.totalCents
    currency = invoice.currency
    source = "invoice"
    invoiceLabel = invoice.invoiceNumber
  } else if (snapshotData?.data) {
    const s = snapshotData.data
    // Snapshot stores cents-as-numeric. Round to integer for
    // consistent display alongside invoice values.
    subtotalCents = parseAmount(s.pricing_base_amount)
    taxCents = parseAmount(s.pricing_taxes)
    feesCents = parseAmount(s.pricing_fees)
    surchargesCents = parseAmount(s.pricing_surcharges)
    totalCents = (subtotalCents ?? 0) + (taxCents ?? 0) + (feesCents ?? 0) + (surchargesCents ?? 0)
    currency = s.pricing_currency ?? defaultCurrency
    source = "snapshot"
  }

  if (source === null || (totalCents != null && totalCents <= 0)) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Pret
          <span className="ml-auto text-muted-foreground text-xs font-normal">
            {source === "invoice"
              ? `From invoice ${invoiceLabel}`
              : "Estimated from catalog snapshot — final on invoice"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          {subtotalCents != null ? (
            <Row label="Subtotal" amountCents={subtotalCents} currency={currency} />
          ) : null}
          {feesCents != null && feesCents > 0 ? (
            <Row label="Taxe administrative" amountCents={feesCents} currency={currency} muted />
          ) : null}
          {surchargesCents != null && surchargesCents > 0 ? (
            <Row label="Suprataxe" amountCents={surchargesCents} currency={currency} muted />
          ) : null}
          {taxCents != null ? (
            <Row
              label="TVA / impozite"
              amountCents={taxCents}
              currency={currency}
              muted={taxCents === 0}
            />
          ) : null}
          {totalCents != null ? (
            <div className="border-t pt-2">
              <Row label="Total" amountCents={totalCents} currency={currency} bold />
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  amountCents,
  currency,
  bold,
  muted,
}: {
  label: string
  amountCents: number
  currency: string
  bold?: boolean
  muted?: boolean
}): React.ReactElement {
  const className = bold ? "text-base font-semibold" : muted ? "text-muted-foreground" : ""
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="font-mono">{formatMoney(amountCents, currency)}</dd>
    </div>
  )
}

function parseAmount(raw: string | null): number {
  if (!raw) return 0
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
