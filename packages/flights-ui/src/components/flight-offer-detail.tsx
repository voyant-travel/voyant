"use client"

import type { FareBreakdown, FlightOffer } from "@voyantjs/flights/contract/types"
import { Badge } from "@voyantjs/ui/components/badge"
import { Separator } from "@voyantjs/ui/components/separator"
import { cn } from "@voyantjs/ui/lib/utils"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { FlightItinerary } from "./flight-itinerary.js"

export interface FlightOfferDetailProps {
  offer: FlightOffer
  /** Resolves IATA carrier code → human-readable name. */
  carrierName?: (iataCode: string) => string | undefined
  /** Resolves IATA airport code → "City Name (IATA)" or similar. */
  airportName?: (iataCode: string) => string | undefined
  /** Resolves IATA aircraft code → "Boeing 737-800" or similar. */
  aircraftName?: (iataCode: string) => string | undefined
  /** Override per-itinerary labels (defaults to "Outbound" / "Return" / "Leg N"). */
  itineraryLabels?: string[]
  className?: string
}

/**
 * Full-fidelity flight offer view for the detail sheet. Composes the shared
 * `FlightItinerary` renderer for each leg, then a fare breakdown + offer
 * metadata. Codeshare segments and layover dwell times are surfaced by the
 * itinerary component itself.
 */
export function FlightOfferDetail({
  offer,
  carrierName,
  airportName,
  aircraftName,
  itineraryLabels,
  className,
}: FlightOfferDetailProps) {
  useFlightsUiMessagesOrDefault()
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <section className="flex flex-col gap-5">
        {offer.itineraries.map((itin, i) => (
          <FlightItinerary
            // biome-ignore lint/suspicious/noArrayIndexKey: itineraries are positional (outbound/return)
            key={i}
            itinerary={itin}
            label={itineraryLabels?.[i] ?? defaultItineraryLabel(i, offer.itineraries.length)}
            carrierName={carrierName}
            airportName={airportName}
            aircraftName={aircraftName}
          />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
          Fare breakdown
        </h4>
        <div className="overflow-hidden rounded-lg border">
          {offer.fareBreakdowns.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable per-breakdown row
            <FareRow key={i} breakdown={b} />
          ))}
          <Separator />
          <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
            <span className="font-medium text-sm">Total</span>
            <span className="font-semibold text-base tabular-nums">
              {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency)}
            </span>
          </div>
        </div>
      </section>

      {(offer.validatingCarrier ||
        offer.expiresAt ||
        offer.lastTicketingDate ||
        offer.instantTicketing) && (
        <section className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {offer.validatingCarrier && (
            <span>
              Validating carrier:{" "}
              <span className="font-mono text-foreground">{offer.validatingCarrier}</span>
            </span>
          )}
          {offer.expiresAt && <span>· Expires {formatDateTime(offer.expiresAt)}</span>}
          {offer.lastTicketingDate && (
            <span>· Last ticketing {formatDate(offer.lastTicketingDate)}</span>
          )}
          {offer.instantTicketing && <Badge variant="secondary">Instant ticketing</Badge>}
        </section>
      )}
    </div>
  )
}

function defaultItineraryLabel(idx: number, total: number): string {
  if (total === 1) return "Itinerary"
  if (total === 2) return idx === 0 ? "Outbound" : "Return"
  return `Leg ${idx + 1}`
}

function FareRow({ breakdown }: { breakdown: FareBreakdown }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <div className="flex flex-col leading-tight">
        <span className="capitalize">
          {breakdown.passengerCount}× {breakdown.passengerType}
        </span>
        {breakdown.fareFamily && (
          <span className="text-muted-foreground text-xs">{breakdown.fareFamily}</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
        <span>Base {formatMoney(breakdown.baseFare.amount, breakdown.baseFare.currency)}</span>
        <span>Tax {formatMoney(breakdown.taxes.amount, breakdown.taxes.currency)}</span>
        <span className="font-medium text-foreground text-sm">
          {formatMoney(breakdown.total.amount, breakdown.total.currency)}
        </span>
      </div>
    </div>
  )
}

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
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
