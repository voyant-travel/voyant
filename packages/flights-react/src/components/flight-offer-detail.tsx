"use client"

import type { FareBreakdown, FlightOffer } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Separator } from "@voyant-travel/ui/components/separator"
import { cn } from "@voyant-travel/ui/lib/utils"
import { useFlightsUiI18nOrDefault } from "../i18n/index.js"
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
  const i18n = useFlightsUiI18nOrDefault()
  const messages = i18n.messages
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <section className="flex flex-col gap-4">
        {offer.itineraries.map((itin, i) => (
          <FlightItinerary
            // biome-ignore lint/suspicious/noArrayIndexKey: itineraries are positional (outbound/return) -- owner: flights-react; existing suppression is intentional pending typed cleanup.
            key={i}
            itinerary={itin}
            label={
              itineraryLabels?.[i] ?? defaultItineraryLabel(i, offer.itineraries.length, messages)
            }
            carrierName={carrierName}
            airportName={airportName}
            aircraftName={aircraftName}
          />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
          {messages.flightOfferDetail.fareBreakdown}
        </h4>
        <div className="overflow-hidden rounded-lg border">
          {offer.fareBreakdowns.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable per-breakdown row -- owner: flights-react; existing suppression is intentional pending typed cleanup.
            <FareRow key={i} breakdown={b} i18n={i18n} />
          ))}
          <Separator />
          <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
            <span className="font-medium text-sm">{messages.common.total}</span>
            <span className="font-semibold text-base tabular-nums">
              {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency, i18n)}
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
              {messages.flightOfferDetail.validatingCarrier}{" "}
              <span className="font-mono text-foreground">{offer.validatingCarrier}</span>
            </span>
          )}
          {offer.expiresAt && (
            <span>
              ·{" "}
              {formatMessage(messages.flightOfferDetail.expires, {
                date: i18n.formatDateTime(offer.expiresAt),
              })}
            </span>
          )}
          {offer.lastTicketingDate && (
            <span>
              ·{" "}
              {formatMessage(messages.flightOfferDetail.lastTicketing, {
                date: i18n.formatDate(offer.lastTicketingDate),
              })}
            </span>
          )}
          {offer.instantTicketing && (
            <Badge variant="secondary">{messages.flightOfferDetail.instantTicketing}</Badge>
          )}
        </section>
      )}
    </div>
  )
}

function defaultItineraryLabel(
  idx: number,
  total: number,
  messages: ReturnType<typeof useFlightsUiI18nOrDefault>["messages"],
): string {
  if (total === 1) return messages.common.legLabels.itinerary
  if (total === 2)
    return idx === 0 ? messages.common.legLabels.outbound : messages.common.legLabels.return
  return formatMessage(messages.common.legLabels.leg, { number: idx + 1 })
}

function FareRow({
  breakdown,
  i18n,
}: {
  breakdown: FareBreakdown
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>
}) {
  const messages = i18n.messages
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <div className="flex flex-col leading-tight">
        <span className="capitalize">
          {breakdown.passengerCount}× {messages.common.passengerTypeLabels[breakdown.passengerType]}
        </span>
        {breakdown.fareFamily && (
          <span className="text-muted-foreground text-xs">{breakdown.fareFamily}</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
        <span>
          {formatMessage(messages.flightOfferDetail.base, {
            amount: formatMoney(breakdown.baseFare.amount, breakdown.baseFare.currency, i18n),
          })}
        </span>
        <span>
          {formatMessage(messages.flightOfferDetail.tax, {
            amount: formatMoney(breakdown.taxes.amount, breakdown.taxes.currency, i18n),
          })}
        </span>
        <span className="font-medium text-foreground text-sm">
          {formatMoney(breakdown.total.amount, breakdown.total.currency, i18n)}
        </span>
      </div>
    </div>
  )
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
