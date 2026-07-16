"use client"

import type { FlightOffer, Money, PassengerCounts } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Check, Pencil, Plane, Users } from "lucide-react"
import { useFlightsUiI18nOrDefault } from "../i18n/index.js"
import { AirlineLogo } from "./airline-logo.js"

/**
 * Per-leg selection passed through the booking journey. Two single-itinerary
 * offers when round-trip; one when one-way. The shell synthesizes a combined
 * offer from these at submit time.
 */
export interface FlightItinerarySelection {
  outbound: FlightOffer
  return?: FlightOffer
}

/**
 * Optional ancillary line items rendered nested under the relevant leg.
 * Phases 2/3 wire bag/seat picks here; for Phase 1 it's just a placeholder
 * shape so the ledger doesn't need to change later.
 */
export interface LedgerLineItem {
  label: string
  amount?: Money
  /** Free-text right-side value (e.g. "Included") when no money applies. */
  meta?: string
}

export interface FlightBookingLedgerProps {
  selection: FlightItinerarySelection
  passengers: PassengerCounts
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  /** Per-leg ancillary line items (bags / seats / extras). */
  outboundExtras?: LedgerLineItem[]
  returnExtras?: LedgerLineItem[]
  /** Sticky CTA at the bottom — typically "Continue" or "Confirm". */
  cta?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }
  /** Per-leg edit handlers — open the search results back up. */
  onEditOutbound?: () => void
  onEditReturn?: () => void
  /** Step status hints — checks shown next to each section name. */
  completedSections?: ReadonlySet<LedgerSection>
  className?: string
}

export type LedgerSection =
  | "flights"
  | "passengers"
  | "bags"
  | "seats"
  | "services"
  | "documents"
  | "billing"
  | "payment"

/**
 * Sticky right-rail price ledger. Mirrors the running total + per-leg
 * breakdown that real airline checkouts use (Wizz/Ryanair/Lufthansa). One
 * source of truth for the total — the shell passes ancillary picks down via
 * `outboundExtras`/`returnExtras`, so the ledger doesn't need to know how
 * they were collected.
 */
export function FlightBookingLedger({
  selection,
  passengers,
  carrierName,
  airportName,
  outboundExtras,
  returnExtras,
  cta,
  onEditOutbound,
  onEditReturn,
  completedSections,
  className,
}: FlightBookingLedgerProps) {
  const i18n = useFlightsUiI18nOrDefault()
  const messages = i18n.messages
  const total = computeTotal(selection, outboundExtras, returnExtras)
  const paxTotal = (passengers.adults ?? 0) + (passengers.children ?? 0) + (passengers.infants ?? 0)

  return (
    <aside
      className={cn(
        "flex w-full max-w-sm flex-col gap-4 rounded-md border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <LegBlock
        label={
          selection.return
            ? messages.flightBookingLedger.outbound
            : messages.flightBookingLedger.flight
        }
        offer={selection.outbound}
        carrierName={carrierName}
        airportName={airportName}
        extras={outboundExtras}
        onEdit={onEditOutbound}
        complete={completedSections?.has("flights")}
        i18n={i18n}
      />
      {selection.return && (
        <LegBlock
          label={messages.flightBookingLedger.return}
          offer={selection.return}
          carrierName={carrierName}
          airportName={airportName}
          extras={returnExtras}
          onEdit={onEditReturn}
          complete={completedSections?.has("flights")}
          i18n={i18n}
        />
      )}

      <SectionRow
        icon={<Users className="h-3.5 w-3.5" />}
        label={messages.flightBookingLedger.passengers}
        right={`${paxTotal} ${messages.common.pax}`}
        complete={completedSections?.has("passengers")}
      />

      <PlaceholderSections completed={completedSections} messages={messages} />

      <div className="mt-2 flex items-center justify-between border-t pt-3">
        <span className="font-medium text-sm">{messages.common.total}</span>
        <span className="font-semibold text-lg tabular-nums">
          {formatMoney(total.amount, total.currency, i18n)}
        </span>
      </div>

      {cta && (
        <Button className="w-full" onClick={cta.onClick} disabled={cta.disabled || cta.loading}>
          {cta.loading ? messages.flightBookingLedger.working : cta.label}
        </Button>
      )}
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function LegBlock({
  label,
  offer,
  carrierName,
  airportName,
  extras,
  onEdit,
  complete,
  i18n,
}: {
  label: string
  offer: FlightOffer
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  extras?: LedgerLineItem[]
  onEdit?: () => void
  complete?: boolean
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>
}) {
  const messages = i18n.messages
  const itin = offer.itineraries[0]
  if (!itin) return null
  const segs = itin.segments
  const first = segs[0]
  const last = segs[segs.length - 1]
  if (!first || !last) return null
  const carriers = Array.from(new Set(segs.map((s) => s.carrierCode)))
  const stops = segs.length - 1

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {complete ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tabular-nums">
            {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency, i18n)}
          </span>
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-muted-foreground"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center -space-x-1">
          {carriers.map((code) => (
            <AirlineLogo key={code} iataCode={code} name={carrierName?.(code)} size={18} />
          ))}
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium text-sm">
            {airportName?.(first.departure.iataCode) ?? first.departure.iataCode} →{" "}
            {airportName?.(last.arrival.iataCode) ?? last.arrival.iataCode}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(first.departure.at, i18n.locale)} ·{" "}
            {formatTime(first.departure.at, i18n.locale)} –{" "}
            {formatTime(last.arrival.at, i18n.locale)} · {formatStops(stops, messages)}
          </span>
        </div>
      </div>

      {extras && extras.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-2">
          {extras.map((x, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: positional list -- owner: flights-react; existing suppression is intentional pending typed cleanup.
              key={i}
              className="flex items-center justify-between text-muted-foreground text-xs"
            >
              <span>{x.label}</span>
              <span className="tabular-nums">
                {x.amount ? formatMoney(x.amount.amount, x.amount.currency, i18n) : (x.meta ?? "")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionRow({
  icon,
  label,
  right,
  complete,
}: {
  icon: React.ReactNode
  label: string
  right?: string
  complete?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-t pt-3">
      <span className="flex items-center gap-1.5 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
        {complete ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <span className="text-muted-foreground">{icon}</span>
        )}
        {label}
      </span>
      {right && <span className="text-muted-foreground text-xs">{right}</span>}
    </div>
  )
}

function PlaceholderSections({
  completed,
  messages,
}: {
  completed?: ReadonlySet<LedgerSection>
  messages: ReturnType<typeof useFlightsUiI18nOrDefault>["messages"]
}) {
  // Phase 1 only renders Passengers above; later phases will replace this with
  // bags/seats/services/documents/billing rows. The shape stays consistent so
  // the ledger doesn't need to change later.
  if (!completed) return null
  const items: { id: LedgerSection; label: string }[] = []
  if (completed.has("billing"))
    items.push({ id: "billing", label: messages.flightBookingLedger.billing })
  if (completed.has("payment"))
    items.push({ id: "payment", label: messages.flightBookingLedger.payment })
  if (items.length === 0) return null
  return (
    <>
      {items.map((it) => (
        <SectionRow key={it.id} icon={<span />} label={it.label} complete={completed.has(it.id)} />
      ))}
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTotal(
  selection: FlightItinerarySelection,
  outboundExtras?: LedgerLineItem[],
  returnExtras?: LedgerLineItem[],
): Money {
  const currency = selection.outbound.totalPrice.currency
  let amount = num(selection.outbound.totalPrice.amount)
  if (selection.return) amount += num(selection.return.totalPrice.amount)
  for (const x of outboundExtras ?? []) amount += num(x.amount?.amount)
  for (const x of returnExtras ?? []) amount += num(x.amount?.amount)
  return { amount: amount.toFixed(2), currency }
}

function num(v: string | undefined): number {
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatMoney(
  amount: string,
  currency: string,
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>,
): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return i18n.formatCurrency(n, currency, { maximumFractionDigits: 0 })
}

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d)
}

function formatStops(
  stops: number,
  messages: ReturnType<typeof useFlightsUiI18nOrDefault>["messages"],
): string {
  if (stops === 0) return messages.common.stops.nonstop
  return formatMessage(
    stops === 1 ? messages.common.stops.oneStop : messages.common.stops.manyStops,
    {
      count: stops,
    },
  )
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
}
