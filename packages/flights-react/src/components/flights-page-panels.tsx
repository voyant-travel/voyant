"use client"

import type { FlightOffer } from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react"
import { useFlightsUiI18nOrDefault, useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import type { FlightFiltersValue } from "./flight-filters-bar.js"
import { FlightItinerary } from "./flight-itinerary.js"

export function PickedLegBanner({
  label,
  offer,
  carrierName,
  airportName,
  onChange,
}: {
  label: string
  offer: FlightOffer
  carrierName: (code: string) => string | undefined
  airportName: (code: string) => string | undefined
  onChange: () => void
}) {
  const { formatCurrency, messages: rootMessages } = useFlightsUiI18nOrDefault()
  const messages = rootMessages.flightsPage
  const itinerary = offer.itineraries[0]
  if (!itinerary) return null
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-medium text-[11px] uppercase tracking-wider text-emerald-700">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-base tabular-nums">
            {formatCurrency(offer.totalPrice.amount, offer.totalPrice.currency, {
              maximumFractionDigits: 0,
            })}
          </span>
          <Button variant="ghost" size="sm" onClick={onChange}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {messages.change}
          </Button>
        </div>
      </div>
      <FlightItinerary
        itinerary={itinerary}
        compact
        carrierName={carrierName}
        airportName={airportName}
      />
    </div>
  )
}

export function ReadyToBookPanel({
  outbound,
  returnLeg,
  carrierName,
  airportName,
  onChangeOutbound,
  onChangeReturn,
  onContinue,
}: {
  outbound: FlightOffer
  returnLeg: FlightOffer
  carrierName: (code: string) => string | undefined
  airportName: (code: string) => string | undefined
  onChangeOutbound: () => void
  onChangeReturn: () => void
  onContinue: () => void
}) {
  const { formatCurrency, messages: rootMessages } = useFlightsUiI18nOrDefault()
  const messages = rootMessages.flightsPage
  const total = Number(outbound.totalPrice.amount) + Number(returnLeg.totalPrice.amount)
  const currency = outbound.totalPrice.currency
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <PickedLegBanner
          label={messages.selectedOutbound}
          offer={outbound}
          carrierName={carrierName}
          airportName={airportName}
          onChange={onChangeOutbound}
        />
        <PickedLegBanner
          label={messages.selectedReturn}
          offer={returnLeg}
          carrierName={carrierName}
          airportName={airportName}
          onChange={onChangeReturn}
        />
      </div>
      <div className="flex flex-col items-stretch gap-3 rounded-md border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
            {messages.tripTotal}
          </span>
          <span className="font-semibold text-2xl tabular-nums">
            {formatCurrency(total, currency, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-muted-foreground text-xs">{messages.tripTotalDescription}</span>
        </div>
        <Button size="lg" onClick={onContinue} className="md:px-8">
          {messages.continueToBooking}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}

export function CacheColdBanner({ message, onReset }: { message: string; onReset: () => void }) {
  const messages = useFlightsUiMessagesOrDefault().flightsPage
  return (
    <div className="rounded-md border border-dashed bg-card p-6 text-center text-muted-foreground text-sm">
      <p>{message}</p>
      <Button className="mt-3" variant="outline" onClick={onReset}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {messages.pickOutboundAgain}
      </Button>
    </div>
  )
}

export function NoResults({ hasFilters }: { hasFilters: boolean }) {
  const messages = useFlightsUiMessagesOrDefault().flightsPage
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
      {hasFilters ? messages.noFilteredResults : messages.noRouteResults}
    </div>
  )
}

export function hasActiveFilters(filters: FlightFiltersValue): boolean {
  return filters.carriers.length > 0 || filters.maxStops != null || filters.maxPrice != null
}
