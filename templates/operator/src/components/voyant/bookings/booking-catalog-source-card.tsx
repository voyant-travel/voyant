"use client"

import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/i18n"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { Calendar, Code, ExternalLink, Hotel, Package, Plane, Ship, Tag, Users } from "lucide-react"
import { useMemo, useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

type CatalogSourceMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["catalogSource"]

interface ResolvedEntity {
  title: string | null
  description: string | null
  supplierName: string | null
  imageUrl: string | null
}

interface ResolvedSource {
  label: string
  providerLabel: string | null
}

/**
 * `/v1/admin/bookings/:id/catalog-snapshot` payload (subset).
 * Server-side enrichment produces the `resolved` block so the client
 * doesn't have to chase ids — the operator sees product names, not
 * `cdmi_…` typeids.
 */
interface BookingCatalogSnapshot {
  id: string
  booking_id: string
  entity_module: string
  entity_id: string
  source_kind: string
  source_provider: string | null
  source_connection_id: string | null
  source_ref: string | null
  pricing_base_amount: string | null
  pricing_taxes: string | null
  pricing_fees: string | null
  pricing_surcharges: string | null
  pricing_currency: string | null
  pricing_breakdown: Record<string, unknown> | null
  frozen_payload: Record<string, unknown>
  captured_at: string
  resolved: {
    entity: ResolvedEntity
    source: ResolvedSource
  }
}

interface SnapshotResponse {
  data: BookingCatalogSnapshot
}

/**
 * Admin-facing card: "what did the customer actually book?". The
 * full underlying snapshot is dense JSON — operators don't read it
 * directly. The card surfaces:
 *
 *   - A heading with the resolved entity title (product name) +
 *     supplier badge + source ("Demo Catalog" / "Bókun" / etc.)
 *   - A short structured "snapshot at booking time" panel: dates,
 *     traveler bands, total amount in major currency units.
 *   - A "View raw payload" button that opens a slide-over sheet
 *     containing the full frozen payload JSON for engineers /
 *     debugging — kept out of the dashboard's normal eye line.
 *
 * Hidden gracefully on legacy bookings (404 → null render).
 */
export function BookingCatalogSourceCard({
  bookingId,
}: {
  bookingId: string
}): React.ReactElement | null {
  const t = useAdminMessages().bookings.detail.catalogSource
  const { data, isLoading } = useQuery({
    queryKey: ["booking-catalog-snapshot", bookingId],
    queryFn: async () => {
      try {
        return await api.get<SnapshotResponse>(
          `/v1/admin/bookings/${encodeURIComponent(bookingId)}/catalog-snapshot`,
        )
      } catch (err) {
        if (err instanceof Error && /404/.test(err.message)) return null
        throw err
      }
    },
    staleTime: 60_000,
  })

  const [payloadOpen, setPayloadOpen] = useState(false)

  if (isLoading) return null
  if (!data?.data) return null

  const snapshot = data.data
  const productLinkId = snapshot.entity_module === "products" ? snapshot.entity_id : null
  const VerticalIcon = verticalIcon(snapshot.entity_module)

  const resolvedTitle = snapshot.resolved.entity.title ?? snapshot.entity_id
  const sourceLabel = snapshot.resolved.source.label
  const providerLabel = snapshot.resolved.source.providerLabel
  const supplierName = snapshot.resolved.entity.supplierName

  // Catalog snapshot stores monetary amounts as cents in a numeric
  // column (e.g. 9900.0000 → 99 EUR). Divide once for display.
  const baseMajor = parseAmount(snapshot.pricing_base_amount) / 100
  const taxesMajor = parseAmount(snapshot.pricing_taxes) / 100
  const feesMajor = parseAmount(snapshot.pricing_fees) / 100
  const surchargesMajor = parseAmount(snapshot.pricing_surcharges) / 100
  const totalMajor = baseMajor + taxesMajor + feesMajor + surchargesMajor
  const currency = snapshot.pricing_currency ?? "EUR"

  const summary = extractStructuredSummary(snapshot.frozen_payload, t)

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start gap-3">
            <VerticalIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <CardTitle className="font-semibold text-base">{resolvedTitle}</CardTitle>
              {snapshot.resolved.entity.description ? (
                <p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">
                  {snapshot.resolved.entity.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className="gap-1">
                  <VerticalIcon className="h-3 w-3" />
                  {labelForModule(snapshot.entity_module, t)}
                </Badge>
                <Badge variant="outline">{sourceLabel}</Badge>
                {providerLabel ? <Badge variant="outline">{providerLabel}</Badge> : null}
                {supplierName ? (
                  <Badge variant="outline" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {supplierName}
                  </Badge>
                ) : null}
              </div>
            </div>
            {productLinkId ? (
              <Link
                to="/products/$id"
                params={{ id: productLinkId }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t.openProduct}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {summary.lines.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.lines.map((line) => (
                <SummaryRow
                  key={line.label}
                  label={line.label}
                  value={line.value}
                  icon={line.icon}
                />
              ))}
            </div>
          ) : null}

          {totalMajor > 0 ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.pricingHeading}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {baseMajor > 0 ? (
                  <PriceCell label={t.priceBase} amount={baseMajor} currency={currency} />
                ) : null}
                {taxesMajor > 0 ? (
                  <PriceCell label={t.priceTaxes} amount={taxesMajor} currency={currency} />
                ) : null}
                {feesMajor > 0 ? (
                  <PriceCell label={t.priceFees} amount={feesMajor} currency={currency} />
                ) : null}
                {surchargesMajor > 0 ? (
                  <PriceCell
                    label={t.priceSurcharges}
                    amount={surchargesMajor}
                    currency={currency}
                  />
                ) : null}
                <PriceCell label={t.priceTotal} amount={totalMajor} currency={currency} bold />
              </dl>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
            <span>
              {formatMessage(t.capturedAt, {
                date: new Date(snapshot.captured_at).toLocaleString(),
              })}
            </span>
            {snapshot.source_ref ? (
              <span>
                {t.sourceRef} <span className="font-mono">{snapshot.source_ref}</span>
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs"
              onClick={() => setPayloadOpen(true)}
            >
              <Code className="mr-1.5 h-3.5 w-3.5" />
              {t.viewRawPayload}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FrozenPayloadSheet
        open={payloadOpen}
        onOpenChange={setPayloadOpen}
        snapshot={snapshot}
        messages={t}
      />
    </>
  )
}

function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Calendar
}): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2 rounded-md border bg-card px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  )
}

function PriceCell({
  label,
  amount,
  currency,
  bold,
}: {
  label: string
  amount: number
  currency: string
  bold?: boolean
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={`text-xs ${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>
        {label}
      </dt>
      <dd className={`text-sm ${bold ? "font-semibold" : ""}`}>{formatMoney(amount, currency)}</dd>
    </div>
  )
}

function FrozenPayloadSheet({
  open,
  onOpenChange,
  snapshot,
  messages,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: BookingCatalogSnapshot
  messages: CatalogSourceMessages
}): React.ReactElement {
  const json = useMemo(() => JSON.stringify(snapshot.frozen_payload, null, 2), [snapshot])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{messages.frozenPayloadTitle}</SheetTitle>
          <SheetDescription>{messages.frozenPayloadDescription}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Badge variant="outline">{snapshot.entity_module}</Badge>
            <Badge variant="outline">{snapshot.resolved.source.label}</Badge>
            <span className="font-mono">{snapshot.entity_id}</span>
            <span className="ml-auto">
              {formatMessage(messages.frozenPayloadBytes, {
                bytes: json.length.toLocaleString(),
              })}
            </span>
          </div>
        </SheetHeader>
        <div className="h-[calc(100vh-9rem)] overflow-auto bg-muted/20 px-6 py-4">
          <pre className="whitespace-pre font-mono text-[11px] leading-relaxed text-foreground/90">
            {json}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface SummaryLine {
  label: string
  value: string
  icon: typeof Calendar
}

/**
 * Pull the few fields admins actually need out of the frozen payload —
 * dates, traveler counts, source ref. The structure varies by upstream
 * adapter; we read defensively and skip what's missing.
 */
function extractStructuredSummary(
  payload: Record<string, unknown>,
  messages: CatalogSourceMessages,
): { lines: SummaryLine[] } {
  const lines: SummaryLine[] = []

  const quote = payload.quote as Record<string, unknown> | undefined
  const upstream = quote?.upstream_payload as Record<string, unknown> | undefined
  const reserve = payload.reserve as Record<string, unknown> | undefined
  const paymentIntent = payload.paymentIntent as Record<string, unknown> | undefined

  // Departure dates from upstream metadata.
  const days = (upstream?.metadata as Record<string, unknown> | undefined)?.days as
    | Array<Record<string, unknown>>
    | undefined
  if (days && days.length > 0) {
    const firstDate = pickStr(days[0]?.date, days[0]?.startDate, days[0]?.startAt)
    const lastDate = pickStr(
      days[days.length - 1]?.date,
      days[days.length - 1]?.endDate,
      days[days.length - 1]?.endAt,
    )
    if (firstDate && lastDate && firstDate !== lastDate) {
      lines.push({
        label: messages.summary.datesLabel,
        value: formatMessage(messages.summary.datesRange, {
          from: formatDate(firstDate),
          to: formatDate(lastDate),
          count: days.length,
        }),
        icon: Calendar,
      })
    } else if (firstDate) {
      lines.push({
        label: messages.summary.dateLabel,
        value: formatDate(firstDate),
        icon: Calendar,
      })
    }
  }

  // Traveler counts from quote.party / parameters.party / upstream
  const party =
    (paymentIntent?.party as Record<string, unknown> | undefined) ??
    (quote?.party as Record<string, unknown> | undefined)
  if (party) {
    const adults = num(party.adults ?? party.adult)
    const children = num(party.children ?? party.child)
    const infants = num(party.infants ?? party.infant)
    const total = (adults ?? 0) + (children ?? 0) + (infants ?? 0)
    if (total > 0) {
      const parts = [
        adults
          ? adults === 1
            ? messages.summary.travelerAdultSingular
            : formatMessage(messages.summary.travelerAdultPlural, { count: adults })
          : null,
        children
          ? children === 1
            ? messages.summary.travelerChildSingular
            : formatMessage(messages.summary.travelerChildPlural, { count: children })
          : null,
        infants
          ? infants === 1
            ? messages.summary.travelerInfantSingular
            : formatMessage(messages.summary.travelerInfantPlural, { count: infants })
          : null,
      ].filter(Boolean)
      lines.push({
        label: messages.summary.travelersLabel,
        value: parts.join(" · "),
        icon: Users,
      })
    }
  }

  // Order ref from reserve.
  const orderId = pickStr(reserve?.orderId, reserve?.orderRef, reserve?.upstream_ref)
  if (orderId) {
    lines.push({
      label: messages.summary.upstreamOrderLabel,
      value: orderId,
      icon: Tag,
    })
  }

  return { lines }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function pickStr(...candidates: unknown[]): string | null {
  for (const c of candidates) if (typeof c === "string" && c.length > 0) return c
  return null
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function parseAmount(raw: string | null): number {
  if (!raw) return 0
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function labelForModule(entityModule: string, messages: CatalogSourceMessages): string {
  const map = messages.moduleLabels
  return map[entityModule as keyof typeof map] ?? entityModule
}

function verticalIcon(entityModule: string) {
  switch (entityModule) {
    case "products":
      return Package
    case "cruises":
      return Ship
    case "accommodations":
      return Hotel
    case "flights":
      return Plane
    default:
      return Package
  }
}
