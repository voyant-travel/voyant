"use client"

import { useQueries, useQueryClient } from "@tanstack/react-query"
import type {
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ChevronLeft, Plane } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import {
  flightsQueryKeys,
  getFlightSeatMapQueryOptions,
  useAirlines,
  useAirports,
  useFlightAncillaries,
  useFlightOfferPrice,
  useSavedPaymentMethods,
  useVoyantFlightsContext,
} from "../index.js"
import { BillingOrgPicker, BillingPersonPicker } from "./billing-pickers.js"
import type { BillingValue } from "./flight-billing-step.js"
import type { FlightItinerarySelection } from "./flight-booking-ledger.js"
import {
  type FlightBookingAncillaries,
  type FlightBookingSavedPaymentMethods,
  type FlightBookingSeatMaps,
  FlightBookingShell,
  type FlightBookingShellProps,
} from "./flight-booking-shell.js"
import type { PaymentStepCapabilities } from "./flight-payment-step.js"
import type { FlightSeatMapSlot } from "./flight-seats-step.js"
import { PassengerContactPicker } from "./passenger-contact-picker.js"

export interface FlightBookingPageProps {
  outboundOfferId: string
  returnOfferId?: string
  passengers: PassengerCounts
  onBackToSearch: () => void
  onBook: (request: FlightBookRequest) => Promise<FlightOrder> | FlightOrder
  onBooked?: (order: FlightOrder) => void
  onEditOutbound?: () => void
  onEditReturn?: () => void
  onSaveBillingDefaults?: (value: BillingValue) => void
  paymentCapabilities?: PaymentStepCapabilities
  renderPassengerPicker?: FlightBookingShellProps["renderPassengerPicker"]
  renderBillingPersonPicker?: (
    apply: (prefill: Partial<BillingValue>) => void,
    helpers: { onPersonSelected: (personId: string | null) => void },
  ) => React.ReactNode
  renderBillingOrgPicker?: (apply: (prefill: Partial<BillingValue>) => void) => React.ReactNode
  onAddPassengerContact?: () => void
  className?: string
}

export function FlightBookingPage({
  outboundOfferId,
  returnOfferId,
  passengers,
  onBackToSearch,
  onBook,
  onBooked,
  onEditOutbound,
  onEditReturn,
  onSaveBillingDefaults,
  paymentCapabilities,
  renderPassengerPicker,
  renderBillingPersonPicker,
  renderBillingOrgPicker,
  onAddPassengerContact,
  className,
}: FlightBookingPageProps) {
  const messages = useFlightsUiMessagesOrDefault().flightBookingPage
  const qc = useQueryClient()

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierName = (code: string) =>
    airlinesQuery.data?.data.find((airline) => airline.iataCode === code)?.name
  const airportName = (code: string) => {
    const airport = airportsQuery.data?.data.find((item) => item.iataCode === code)
    return airport ? `${airport.city} (${airport.iataCode})` : undefined
  }

  const [outbound, setOutbound] = useState<FlightOffer | null>(() =>
    readOfferFromCache(qc, outboundOfferId),
  )
  const [returnLeg, setReturnLeg] = useState<FlightOffer | null>(() =>
    returnOfferId ? readOfferFromCache(qc, returnOfferId) : null,
  )
  const [livePriceError, setLivePriceError] = useState<string | null>(null)
  const [pricedReady, setPricedReady] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const priceMutation = useFlightOfferPrice()

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-price once on mount per offer pair -- owner: flights-react; existing suppression is intentional pending typed cleanup.
  useEffect(() => {
    let cancelled = false
    const repriceLeg = async (
      offer: FlightOffer | null,
      setter: (offer: FlightOffer | null) => void,
    ): Promise<string | null> => {
      if (!offer) return null
      try {
        const result = await priceMutation.mutateAsync({ offerId: offer.offerId, offer })
        if (cancelled) return null
        if (!result.valid) return result.invalidReason ?? messages.offerUnavailable
        setter(result.offer)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    }
    Promise.all([repriceLeg(outbound, setOutbound), repriceLeg(returnLeg, setReturnLeg)]).then(
      ([err1, err2]) => {
        if (cancelled) return
        const err = err1 ?? err2
        if (err) setLivePriceError(err)
        else setPricedReady(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [outboundOfferId, returnOfferId])

  const outboundAncillaries = useFlightAncillaries(
    outbound ? { offerId: outbound.offerId, offer: outbound } : null,
    { enabled: pricedReady && outbound != null },
  )
  const returnAncillaries = useFlightAncillaries(
    returnLeg ? { offerId: returnLeg.offerId, offer: returnLeg } : null,
    { enabled: pricedReady && returnLeg != null },
  )

  const ancillaries: FlightBookingAncillaries = {
    outboundCatalog: outboundAncillaries.data?.catalog ?? null,
    returnCatalog: returnAncillaries.data?.catalog ?? null,
    loading: outboundAncillaries.isLoading || (returnLeg != null && returnAncillaries.isLoading),
  }

  const seatMaps = useSeatMapFetcher({ outbound, returnLeg, enabled: pricedReady, messages })

  const savedMethodsQuery = useSavedPaymentMethods(selectedPersonId, {
    enabled: !!selectedPersonId,
  })
  const savedPaymentMethods: FlightBookingSavedPaymentMethods = {
    methods: (savedMethodsQuery.data?.data ?? []).map((method) => ({
      id: method.id,
      label: [brandHumanLabel(method.brand, messages), method.last4 ? `....${method.last4}` : null]
        .filter(Boolean)
        .join(" "),
      provider: null,
      instrumentType:
        method.brand === "bank_transfer" ? ("bank_account" as const) : ("credit_card" as const),
      status: "active" as const,
      brand: method.brand,
      last4: method.last4,
      expiryMonth: method.expMonth ?? null,
      expiryYear: method.expYear ?? null,
      isDefault: method.isDefault,
    })),
    loading: savedMethodsQuery.isLoading,
  }

  const documentsRequired = useMemo(
    () => detectInternational(outbound) || detectInternational(returnLeg),
    [outbound, returnLeg],
  )

  const selection: FlightItinerarySelection | null = useMemo(() => {
    if (!outbound) return null
    if (returnOfferId && !returnLeg) return null
    return returnLeg ? { outbound, return: returnLeg } : { outbound }
  }, [outbound, returnLeg, returnOfferId])

  if (!selection) {
    return (
      <div className={cn("mx-auto w-full max-w-2xl", className)}>
        <div className="rounded-md border border-dashed bg-card p-8 text-center">
          <Plane className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-medium text-base">{messages.offerNotInSessionTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            {messages.offerNotInSessionDescription}
          </p>
          <Button className="mt-4" onClick={onBackToSearch}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {messages.backToFlightSearch}
          </Button>
        </div>
      </div>
    )
  }

  if (livePriceError) {
    return (
      <div className={cn("mx-auto w-full max-w-2xl px-6 py-10", className)}>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-destructive text-sm">
          <p className="font-medium">{livePriceError}</p>
          <Button variant="outline" className="mt-4" onClick={onBackToSearch}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {messages.backToFlightSearch}
          </Button>
        </div>
      </div>
    )
  }

  const defaultPassengerPicker: FlightBookingShellProps["renderPassengerPicker"] = (
    _slot,
    onPicked,
  ) => (
    <PassengerContactPicker
      onPick={onPicked}
      onAddContact={onAddPassengerContact}
      onPersonSelected={setSelectedPersonId}
    />
  )

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 py-6 lg:px-8",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">{messages.title}</h1>
          <p className="text-muted-foreground text-sm">
            {selection.return ? messages.descriptionTrip : messages.descriptionOffer}
          </p>
        </div>
        <Button variant="ghost" onClick={onBackToSearch}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {messages.backToResults}
        </Button>
      </header>

      <FlightBookingShell
        selection={selection}
        passengers={passengers}
        carrierName={carrierName}
        airportName={airportName}
        ancillaries={ancillaries}
        seatMaps={seatMaps}
        savedPaymentMethods={savedPaymentMethods}
        paymentCapabilities={paymentCapabilities}
        documentsRequired={documentsRequired}
        renderPassengerPicker={renderPassengerPicker ?? defaultPassengerPicker}
        renderBillingPersonPicker={(apply) =>
          renderBillingPersonPicker ? (
            renderBillingPersonPicker(apply, { onPersonSelected: setSelectedPersonId })
          ) : (
            <BillingPersonPicker apply={apply} onPersonSelected={setSelectedPersonId} />
          )
        }
        renderBillingOrgPicker={(apply) =>
          renderBillingOrgPicker ? (
            renderBillingOrgPicker(apply)
          ) : (
            <BillingOrgPicker apply={apply} />
          )
        }
        onSaveBillingDefaults={onSaveBillingDefaults}
        onCancel={onBackToSearch}
        onEditOutbound={onEditOutbound ?? onBackToSearch}
        onEditReturn={onEditReturn ?? onBackToSearch}
        onBook={onBook}
        onBooked={onBooked}
      />
    </div>
  )
}

function brandHumanLabel(
  brand: string,
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>["flightBookingPage"],
): string {
  switch (brand) {
    case "visa":
      return messages.paymentBrandLabels.visa
    case "mastercard":
      return messages.paymentBrandLabels.mastercard
    case "amex":
      return messages.paymentBrandLabels.amex
    case "revolut":
      return messages.paymentBrandLabels.revolut
    case "bank_transfer":
      return messages.paymentBrandLabels.bank_transfer
    default:
      return brand
  }
}

function readOfferFromCache(
  qc: ReturnType<typeof useQueryClient>,
  offerId: string,
): FlightOffer | null {
  const cached = qc.getQueryData<{ offer: FlightOffer }>(flightsQueryKeys.offerDetail(offerId))
  return cached?.offer ?? null
}

function detectInternational(offer: FlightOffer | null): boolean {
  if (!offer) return false
  const first = offer.itineraries[0]?.segments[0]
  const lastItinerary = offer.itineraries[offer.itineraries.length - 1]
  const last = lastItinerary?.segments[lastItinerary.segments.length - 1]
  if (!first || !last) return false
  return first.departure.iataCode.slice(0, 1) !== last.arrival.iataCode.slice(0, 1)
}

function useSeatMapFetcher({
  outbound,
  returnLeg,
  enabled,
  messages,
}: {
  outbound: FlightOffer | null
  returnLeg: FlightOffer | null
  enabled: boolean
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>["flightBookingPage"]
}): FlightBookingSeatMaps {
  const client = useVoyantFlightsContext()

  const segmentInputs = useMemo(() => {
    const list: { offerId: string; segmentId: string; offer: FlightOffer }[] = []
    const addFrom = (offer: FlightOffer | null) => {
      if (!offer) return
      for (const itinerary of offer.itineraries) {
        for (const segment of itinerary.segments) {
          list.push({ offerId: offer.offerId, segmentId: segment.segmentId, offer })
        }
      }
    }
    addFrom(outbound)
    addFrom(returnLeg)
    return list
  }, [outbound, returnLeg])

  const results = useQueries({
    queries: segmentInputs.map((input) => ({
      ...getFlightSeatMapQueryOptions(client, input),
      enabled,
      staleTime: 5 * 60_000,
    })),
  })

  const slotsBySegment = useMemo(() => {
    const map = new Map<string, FlightSeatMapSlot>()
    segmentInputs.forEach((input, index) => {
      const result = results[index]
      map.set(input.segmentId, {
        seatMap: result?.data?.seatMap ?? null,
        loading: result?.isLoading,
        error: result?.error instanceof Error ? result.error.message : null,
      })
    })
    return map
  }, [segmentInputs, results])

  return useMemo<FlightBookingSeatMaps>(
    () => ({
      getSeatMap: ({ segmentId }) =>
        slotsBySegment.get(segmentId) ?? { seatMap: null, error: messages.segmentNotFound },
    }),
    [slotsBySegment, messages.segmentNotFound],
  )
}
