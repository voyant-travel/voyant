"use client"

import { useQueries, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { FlightOffer } from "@voyantjs/flights/contract/types"
import {
  flightsQueryKeys,
  getFlightSeatMapQueryOptions,
  useAirlines,
  useAirports,
  useFlightAncillaries,
  useFlightBook,
  useFlightOfferPrice,
  useSavedPaymentMethods,
  useVoyantFlightsContext,
} from "@voyantjs/flights-react"
import {
  type FlightBookingAncillaries,
  type FlightBookingSavedPaymentMethods,
  type FlightBookingSeatMaps,
  FlightBookingShell,
  type FlightItinerarySelection,
  type FlightSeatMapSlot,
  type PaymentStepCapabilities,
} from "@voyantjs/flights-ui"
import { Button } from "@voyantjs/ui/components/button"
import { ChevronLeft, Plane } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Route } from "@/routes/_workspace/flights_.book.$offerId"
import { BillingOrgPicker, BillingPersonPicker } from "./billing-pickers"
import { PassengerContactPicker } from "./passenger-contact-picker"

export function FlightBookingPage() {
  const navigate = useNavigate()
  const { offerId: outboundId } = Route.useParams()
  const search = Route.useSearch()
  const qc = useQueryClient()

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierName = (code: string) =>
    airlinesQuery.data?.data.find((a) => a.iataCode === code)?.name
  const airportName = (code: string) => {
    const a = airportsQuery.data?.data.find((x) => x.iataCode === code)
    return a ? `${a.city} (${a.iataCode})` : undefined
  }

  // Both offers come from the search-results page via TanStack Query cache.
  const [outbound, setOutbound] = useState<FlightOffer | null>(() =>
    readOfferFromCache(qc, outboundId),
  )
  const [returnLeg, setReturnLeg] = useState<FlightOffer | null>(() =>
    search.return ? readOfferFromCache(qc, search.return) : null,
  )
  const [livePriceError, setLivePriceError] = useState<string | null>(null)
  const [pricedReady, setPricedReady] = useState(false)

  // The picked-person id propagates across steps for: payment-methods lookup,
  // billing prefill, future write-back. Set when the operator selects a CRM
  // contact in either the passenger picker or the billing picker.
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const priceMutation = useFlightOfferPrice()

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-price once on mount per offer pair
  useEffect(() => {
    let cancelled = false
    const repriceLeg = async (
      offer: FlightOffer | null,
      setter: (o: FlightOffer | null) => void,
    ): Promise<string | null> => {
      if (!offer) return null
      try {
        const res = await priceMutation.mutateAsync({ offerId: offer.offerId, offer })
        if (cancelled) return null
        if (!res.valid) return res.invalidReason ?? "This offer is no longer available."
        setter(res.offer)
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
  }, [outboundId, search.return])

  // Ancillary catalogs per leg.
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

  // Seat maps per segment in parallel.
  const seatMaps = useSeatMapFetcher({ outbound, returnLeg, enabled: pricedReady })

  // Saved payment methods, keyed off the picked person. The CRM row shape
  // from `/v1/crm/people/:id/payment-methods` is mapped onto the canonical
  // `SavedPaymentAccount` projection (`PublicBookingPaymentOptions.accounts[]`)
  // that <PaymentStep> consumes. This bridge goes away once flights are
  // integrated with bookings + finance — the booking will already have a
  // `payment_session` lookup that returns the projection shape directly.
  const savedMethodsQuery = useSavedPaymentMethods(selectedPersonId, {
    enabled: !!selectedPersonId,
  })
  const savedPaymentMethods: FlightBookingSavedPaymentMethods = {
    methods: (savedMethodsQuery.data?.data ?? []).map((m) => ({
      id: m.id,
      label: [brandHumanLabel(m.brand), m.last4 ? `····${m.last4}` : null]
        .filter(Boolean)
        .join(" "),
      provider: null,
      instrumentType:
        m.brand === "bank_transfer" ? ("bank_account" as const) : ("credit_card" as const),
      status: "active" as const,
      brand: m.brand,
      last4: m.last4,
      expiryMonth: m.expMonth ?? null,
      expiryYear: m.expYear ?? null,
      isDefault: m.isDefault,
    })),
    loading: savedMethodsQuery.isLoading,
  }

  // Documents are required when ANY segment crosses borders. Crude heuristic:
  // the first + last airport in the offer have IATA prefixes that differ. This
  // is a placeholder — a real implementation walks the airports table to look
  // up countries.
  const documentsRequired = useMemo(
    () => detectInternational(outbound) || detectInternational(returnLeg),
    [outbound, returnLeg],
  )

  const bookMutation = useFlightBook()

  // What the operator template can actually do RIGHT NOW (see `src/api/app.ts`):
  //   - Netopia is the configured processor; it doesn't support stored-token
  //     charges, and we don't have an embedded card SDK wired → both false.
  // Hold (which generates the payment link) and the agency-credit extra are
  // always rendered by the shell — they don't need capability flags.
  const paymentCapabilities: PaymentStepCapabilities = useMemo(
    () => ({ chargeSavedCard: false, newCard: false }),
    [],
  )

  const counts = useMemo(
    () => ({
      adults: search.pax_a ?? 1,
      children: search.pax_c ?? 0,
      infants: search.pax_i ?? 0,
    }),
    [search.pax_a, search.pax_c, search.pax_i],
  )

  const selection: FlightItinerarySelection | null = useMemo(() => {
    if (!outbound) return null
    if (search.return && !returnLeg) return null
    return returnLeg ? { outbound, return: returnLeg } : { outbound }
  }, [outbound, returnLeg, search.return])

  if (!selection) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <Plane className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-medium text-base">Offer not in session</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            This booking link references an offer that's no longer in your browser session. Run the
            search again to pick a fresh offer.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/flights" })}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to flight search
          </Button>
        </div>
      </div>
    )
  }

  if (livePriceError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-destructive text-sm">
          <p className="font-medium">{livePriceError}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/flights" })}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to flight search
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 py-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">Book your flight</h1>
          <p className="text-muted-foreground text-sm">
            Confirm passenger details, contact, and payment to lock in this{" "}
            {selection.return ? "trip" : "offer"}.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/flights" })}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to results
        </Button>
      </header>

      <FlightBookingShell
        selection={selection}
        passengers={counts}
        carrierName={carrierName}
        airportName={airportName}
        ancillaries={ancillaries}
        seatMaps={seatMaps}
        savedPaymentMethods={savedPaymentMethods}
        paymentCapabilities={paymentCapabilities}
        documentsRequired={documentsRequired}
        renderPassengerPicker={(_slot, onPicked) => (
          <PassengerContactPicker
            onPick={(prefill) => {
              onPicked(prefill)
              // The picker calls back with the prefill payload but doesn't
              // expose the picked person id today; for now we leave the
              // selectedPersonId untouched here and rely on the billing
              // picker to set it. Future: thread the personId through.
            }}
          />
        )}
        renderBillingPersonPicker={(apply) => (
          <BillingPersonPicker apply={apply} onPersonSelected={(id) => setSelectedPersonId(id)} />
        )}
        renderBillingOrgPicker={(apply) => <BillingOrgPicker apply={apply} />}
        onSaveBillingDefaults={(value) => {
          // TODO(phase-4-followup): write back to identity_addresses for the
          // picked person + (when company tab) update org's primary address.
          console.info("[billing] save-as-default requested", value)
        }}
        onCancel={() => navigate({ to: "/flights" })}
        onEditOutbound={() => navigate({ to: "/flights" })}
        onEditReturn={() => navigate({ to: "/flights" })}
        onBook={async (req) => {
          const res = await bookMutation.mutateAsync(req)
          return res.order
        }}
        onBooked={(order) => {
          navigate({
            to: "/flights/orders/$orderId",
            params: { orderId: order.orderId },
          })
        }}
      />
    </div>
  )
}

function brandHumanLabel(b: string): string {
  switch (b) {
    case "visa":
      return "Visa"
    case "mastercard":
      return "Mastercard"
    case "amex":
      return "Amex"
    case "revolut":
      return "Revolut Pay"
    case "bank_transfer":
      return "Bank transfer"
    default:
      return b
  }
}

function readOfferFromCache(
  qc: ReturnType<typeof useQueryClient>,
  offerId: string,
): FlightOffer | null {
  const cached = qc.getQueryData<{ offer: FlightOffer }>(flightsQueryKeys.offerDetail(offerId))
  return cached?.offer ?? null
}

/**
 * Heuristic — true when the offer's first departure airport differs from
 * its last arrival airport in a way suggesting an international route.
 * Replace with an airport-table-backed country lookup for production.
 */
function detectInternational(offer: FlightOffer | null): boolean {
  if (!offer) return false
  const first = offer.itineraries[0]?.segments[0]
  const lastItin = offer.itineraries[offer.itineraries.length - 1]
  const last = lastItin?.segments[lastItin.segments.length - 1]
  if (!first || !last) return false
  // Cheap heuristic — UK + EU airports often share 3-letter prefixes within a
  // country; if the codes differ entirely it's almost certainly cross-border.
  return first.departure.iataCode.slice(0, 1) !== last.arrival.iataCode.slice(0, 1)
}

function useSeatMapFetcher({
  outbound,
  returnLeg,
  enabled,
}: {
  outbound: FlightOffer | null
  returnLeg: FlightOffer | null
  enabled: boolean
}): FlightBookingSeatMaps {
  const client = useVoyantFlightsContext()

  const segmentInputs = useMemo(() => {
    const list: { offerId: string; segmentId: string; offer: FlightOffer }[] = []
    const addFrom = (offer: FlightOffer | null) => {
      if (!offer) return
      for (const itin of offer.itineraries) {
        for (const seg of itin.segments) {
          list.push({ offerId: offer.offerId, segmentId: seg.segmentId, offer })
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
    const m = new Map<string, FlightSeatMapSlot>()
    segmentInputs.forEach((input, i) => {
      const r = results[i]
      m.set(input.segmentId, {
        seatMap: r?.data?.seatMap ?? null,
        loading: r?.isLoading,
        error: r?.error instanceof Error ? r.error.message : null,
      })
    })
    return m
  }, [segmentInputs, results])

  return useMemo<FlightBookingSeatMaps>(
    () => ({
      getSeatMap: ({ segmentId }) =>
        slotsBySegment.get(segmentId) ?? { seatMap: null, error: "Segment not found" },
    }),
    [slotsBySegment],
  )
}
