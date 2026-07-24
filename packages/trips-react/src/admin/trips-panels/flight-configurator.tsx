"use client"

import { useOperatorAdminMessages as useAdminMessages } from "@voyant-travel/admin"
import type {
  CabinClass,
  FlightOffer,
  FlightPassenger,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { useFlightAncillaries, useFlightSearch } from "@voyant-travel/flights-react"
import {
  AirportCombobox,
  FlightBaggageStep,
  FlightFareUpsellStep,
  FlightOfferRow,
  FlightServicesStep,
} from "@voyant-travel/flights-react/ui"
import { formatMessage } from "@voyant-travel/i18n"
import { Button } from "@voyant-travel/ui/components/button"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Loader2, X } from "lucide-react"
import * as React from "react"

import { formatMoney } from "./display.js"
import { Field, type PendingComponent } from "./shared.js"
import type { TripTraveler } from "./travelers-section.js"

export function FlightConfigurator({
  pending,
  travelers,
  onChange,
}: {
  pending: Extract<PendingComponent, { kind: "flight" }>
  travelers: TripTraveler[]
  onChange(next: PendingComponent): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const passengers = React.useMemo(() => flightPassengersFromTripTravelers(travelers), [travelers])
  const passengerCounts = React.useMemo(
    () => passengerCountsFromTripTravelers(travelers),
    [travelers],
  )
  const isRoundTrip = pending.tripType === "round_trip"
  const ready = Boolean(
    pending.origin &&
      pending.destination &&
      pending.departDate &&
      (!isRoundTrip || pending.returnDate),
  )
  const slices = React.useMemo(() => {
    if (!pending.origin || !pending.destination || !pending.departDate) return []
    const next = [
      {
        origin: pending.origin,
        destination: pending.destination,
        departureDate: pending.departDate,
      },
    ]
    if (pending.tripType === "round_trip" && pending.returnDate) {
      next.push({
        origin: pending.destination,
        destination: pending.origin,
        departureDate: pending.returnDate,
      })
    }
    return next
  }, [
    pending.departDate,
    pending.destination,
    pending.origin,
    pending.returnDate,
    pending.tripType,
  ])
  const search = useFlightSearch(
    {
      slices,
      passengers: passengerCounts,
      cabin: pending.cabin,
    },
    { enabled: ready },
  )
  const offers = search.data?.offers ?? []
  const selectedOffer =
    pending.selectedOffer &&
    offers.some((offer) => offer.offerId === pending.selectedOffer?.offerId)
      ? pending.selectedOffer
      : pending.selectedOffer
  const ancillaryQuery = useFlightAncillaries(
    selectedOffer ? { offerId: selectedOffer.offerId, offer: selectedOffer } : null,
    { enabled: Boolean(selectedOffer) },
  )
  const ancillaryCatalog = ancillaryQuery.data?.catalog ?? pending.ancillaryCatalog
  const priced = flightPricingFromPending({
    ...pending,
    selectedOffer,
    ancillaryCatalog,
  })
  const searchErrorMessage = search.error instanceof Error ? search.error.message : null

  const patch = (next: Partial<Extract<PendingComponent, { kind: "flight" }>>) => {
    onChange({ ...pending, ...next })
  }

  const resetSelection = (next: Partial<Extract<PendingComponent, { kind: "flight" }>>) => {
    patch({
      selectedOffer: null,
      ancillaryCatalog: null,
      fareBundlePicks: [],
      baggagePicks: [],
      assistancePicks: [],
      extrasPicks: [],
      ...next,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isRoundTrip ? "default" : "outline"}
          onClick={() => resetSelection({ tripType: "one_way", returnDate: "" })}
        >
          {t.flightOneWay}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isRoundTrip ? "default" : "outline"}
          onClick={() => resetSelection({ tripType: "round_trip" })}
        >
          {t.flightRoundTrip}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.flightOrigin}>
          <AirportCombobox
            value={pending.origin}
            placeholder={t.fromPlaceholder}
            onChange={(code) => resetSelection({ origin: code })}
            className="w-full"
          />
        </Field>
        <Field label={t.flightDestination}>
          <AirportCombobox
            value={pending.destination}
            placeholder={t.toPlaceholder}
            onChange={(code) => resetSelection({ destination: code })}
            className="w-full"
          />
        </Field>
        <Field label={t.flightDepart}>
          <DatePicker
            value={pending.departDate}
            onChange={(departDate) => resetSelection({ departDate: departDate ?? "" })}
            placeholder={t.pickDate}
          />
        </Field>
        {isRoundTrip ? (
          <Field label={t.flightReturn}>
            <div className="flex gap-2">
              <DatePicker
                value={pending.returnDate}
                onChange={(returnDate) => resetSelection({ returnDate: returnDate ?? "" })}
                placeholder={t.pickDate}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.clearReturnDate}
                onClick={() => resetSelection({ returnDate: "" })}
              >
                <X className="size-4" />
              </Button>
            </div>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">{t.travelersWord}</span>
          <span className="text-muted-foreground text-xs">
            {passengerCounts.adults === 1
              ? t.travelerCountAdultSingular
              : formatMessage(t.travelerCountAdultPlural, { count: passengerCounts.adults })}
            {passengerCounts.children
              ? formatMessage(
                  passengerCounts.children === 1 ? t.travelerCountChild : t.travelerCountChildren,
                  { count: passengerCounts.children },
                )
              : ""}
            {passengerCounts.infants
              ? formatMessage(
                  passengerCounts.infants === 1 ? t.travelerCountInfant : t.travelerCountInfants,
                  { count: passengerCounts.infants },
                )
              : ""}
          </span>
        </div>
        <CabinSelector value={pending.cabin} onChange={(cabin) => resetSelection({ cabin })} />
      </div>

      {ready ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium text-sm">{t.flightOptionsHeading}</h4>
            {search.isFetching ? (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Loader2 className="size-3 animate-spin" />
                {t.flightSearching}
              </span>
            ) : offers.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                {formatMessage(t.flightOptionsCount, { count: offers.length })}
              </span>
            ) : null}
          </div>
          {search.isError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {searchErrorMessage ?? t.flightSearchFailed}
            </p>
          ) : null}
          {!search.isFetching && offers.length === 0 && !search.isError ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              {t.flightNoOptions}
            </p>
          ) : null}
          {offers.slice(0, 5).map((offer) => (
            <FlightOfferRow
              key={offer.offerId}
              offer={offer}
              selected={selectedOffer?.offerId === offer.offerId}
              selectLabel={
                selectedOffer?.offerId === offer.offerId ? t.flightSelected : t.flightSelect
              }
              onSelect={(nextOffer) =>
                patch({
                  selectedOffer: nextOffer,
                  ancillaryCatalog: null,
                  fareBundlePicks: [],
                  baggagePicks: [],
                  assistancePicks: [],
                  extrasPicks: [],
                })
              }
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
          {t.flightSelectSearchHint}
        </p>
      )}

      {selectedOffer ? (
        <div className="flex flex-col gap-4 border-t pt-4">
          <FlightFareUpsellStep
            outboundOffer={legOffer(selectedOffer, 0)}
            returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
            passengers={passengers}
            passengerCounts={passengerCounts}
            value={pending.fareBundlePicks}
            onChange={(fareBundlePicks) => patch({ fareBundlePicks })}
            sameForAllPassengers={pending.sameFareForAllPassengers}
            onSameForAllPassengersChange={(sameFareForAllPassengers) =>
              patch({ sameFareForAllPassengers })
            }
          />

          {ancillaryQuery.isError ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              {t.flightAncillariesUnavailable}
            </p>
          ) : (
            <FlightBaggageStep
              outboundCatalog={ancillaryCatalog}
              returnCatalog={selectedOffer.itineraries[1] ? ancillaryCatalog : null}
              outboundOffer={legOffer(selectedOffer, 0)}
              returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
              passengers={passengers}
              passengerCounts={passengerCounts}
              value={pending.baggagePicks}
              onChange={(baggagePicks) =>
                patch({ baggagePicks, ancillaryCatalog: ancillaryCatalog ?? null })
              }
              sameForBothDirections={pending.sameBaggageBothDirections}
              onSameForBothDirectionsChange={(sameBaggageBothDirections) =>
                patch({ sameBaggageBothDirections })
              }
              loading={ancillaryQuery.isFetching}
            />
          )}

          {ancillaryCatalog ? (
            <FlightServicesStep
              outboundCatalog={ancillaryCatalog}
              returnCatalog={selectedOffer.itineraries[1] ? ancillaryCatalog : null}
              outboundOffer={legOffer(selectedOffer, 0)}
              returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
              passengers={passengers}
              passengerCounts={passengerCounts}
              assistance={pending.assistancePicks}
              extras={pending.extrasPicks}
              onAssistanceChange={(assistancePicks) => patch({ assistancePicks })}
              onExtrasChange={(extrasPicks) => patch({ extrasPicks })}
              loading={ancillaryQuery.isFetching}
            />
          ) : null}

          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <span className="text-muted-foreground text-sm">{t.flightTotal}</span>
            <span className="font-semibold text-base">
              {formatMoney(priced.totalAmountCents, priced.currency)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CabinSelector({
  value,
  onChange,
}: {
  value: CabinClass
  onChange(next: CabinClass): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const cabins: Array<{ value: CabinClass; label: string }> = [
    { value: "economy", label: t.cabinClasses.economy },
    { value: "premium_economy", label: t.cabinClasses.premium_economy },
    { value: "business", label: t.cabinClasses.business },
    { value: "first", label: t.cabinClasses.first },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {cabins.map((cabin) => (
        <Button
          key={cabin.value}
          type="button"
          size="sm"
          variant={value === cabin.value ? "default" : "outline"}
          onClick={() => onChange(cabin.value)}
        >
          {cabin.label}
        </Button>
      ))}
    </div>
  )
}

interface FlightPricingBreakdown {
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  ancillaryAmountCents: number
  totalAmountCents: number
}

export function flightPricingFromPending(
  pending: Extract<PendingComponent, { kind: "flight" }>,
): FlightPricingBreakdown {
  const offer = pending.selectedOffer
  if (!offer) {
    return {
      currency: "EUR",
      subtotalAmountCents: 0,
      taxAmountCents: 0,
      ancillaryAmountCents: 0,
      totalAmountCents: 0,
    }
  }
  const currencyCode = offer.totalPrice.currency
  const offerTotal = moneyToCents(offer.totalPrice.amount)
  const fareTax = offer.fareBreakdowns.reduce(
    (sum, line) => sum + moneyToCents(line.taxes.amount),
    0,
  )
  const ancillaryAmount = flightAncillaryAmountCents(pending, currencyCode)
  return {
    currency: currencyCode,
    subtotalAmountCents: Math.max(0, offerTotal - fareTax) + ancillaryAmount,
    taxAmountCents: fareTax,
    ancillaryAmountCents: ancillaryAmount,
    totalAmountCents: offerTotal + ancillaryAmount,
  }
}

function flightAncillaryAmountCents(
  pending: Extract<PendingComponent, { kind: "flight" }>,
  currencyCode: string,
): number {
  const offer = pending.selectedOffer
  const catalog = pending.ancillaryCatalog
  if (!offer) return 0

  const fareBundles = offer.fareBundles ?? []
  const fareBundleTotal = pending.fareBundlePicks.reduce((sum, pick) => {
    const bundle = fareBundles.find((candidate) => candidate.id === pick.bundleId)
    if (!bundle || bundle.priceDelta.currency !== currencyCode) return sum
    return sum + moneyToCents(bundle.priceDelta.amount)
  }, 0)

  if (!catalog) return fareBundleTotal

  const baggageTotal = pending.baggagePicks.reduce((sum, pick) => {
    const option = catalog.baggage.find((candidate) => candidate.id === pick.optionId)
    if (!option || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount) * (pick.quantity ?? 1)
  }, 0)

  const assistanceTotal = pending.assistancePicks.reduce((sum, pick) => {
    const option = catalog.assistance.find((candidate) => candidate.id === pick.optionId)
    if (!option?.price || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount)
  }, 0)

  const extrasTotal = pending.extrasPicks.reduce((sum, pick) => {
    const option = catalog.extras.find((candidate) => candidate.id === pick.optionId)
    if (!option || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount) * (pick.quantity ?? 1)
  }, 0)

  return fareBundleTotal + baggageTotal + assistanceTotal + extrasTotal
}

function legOffer(offer: FlightOffer, index: number): FlightOffer {
  const itinerary = offer.itineraries[index]
  return itinerary ? { ...offer, itineraries: [itinerary] } : offer
}

function moneyToCents(amount: string): number {
  const parsed = Number.parseFloat(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function passengerCountsFromTripTravelers(travelers: TripTraveler[]): PassengerCounts {
  const counts = travelers.reduce(
    (acc, traveler) => {
      if (traveler.role === "child") acc.children += 1
      else if (traveler.role === "infant") acc.infants += 1
      else acc.adults += 1
      return acc
    },
    { adults: 0, children: 0, infants: 0 },
  )
  return {
    adults: Math.max(1, counts.adults),
    children: counts.children,
    infants: counts.infants,
  }
}

function flightPassengersFromTripTravelers(travelers: TripTraveler[]): FlightPassenger[] {
  return travelers.map((traveler, index) => {
    const type =
      traveler.role === "child" ? "child" : traveler.role === "infant" ? "infant" : "adult"
    return {
      passengerId: traveler.localId || `traveler_${index + 1}`,
      type,
      // fallback names sent verbatim to the flight provider's API as ASCII
      // passenger placeholders when the operator hasn't yet filled in the
      // real traveler.
      firstName:
        // i18n-literal-ok
        traveler.firstName || (type === "adult" ? "Adult" : type === "child" ? "Child" : "Infant"),
      lastName: traveler.lastName || `${index + 1}`,
      dateOfBirth: traveler.dateOfBirth || fallbackDobForPassengerType(type),
      ...(traveler.email ? { email: traveler.email } : {}),
    }
  })
}

function fallbackDobForPassengerType(type: FlightPassenger["type"]): string {
  if (type === "child") return "2016-01-01"
  if (type === "infant") return "2025-01-01"
  return "1990-01-01"
}
