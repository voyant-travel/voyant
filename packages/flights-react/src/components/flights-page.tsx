"use client"

import { useQueryClient } from "@tanstack/react-query"
import type {
  FlightOffer,
  FlightSearchRequest,
  PassengerCounts,
} from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components/sheet"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ChevronLeft, ChevronRight, Plane } from "lucide-react"
import { useMemo, useState } from "react"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { flightsQueryKeys, useAirlines, useAirports, useFlightSearch } from "../index.js"
import { FlightFiltersBar, type FlightFiltersValue } from "./flight-filters-bar.js"
import { FlightOfferDetail } from "./flight-offer-detail.js"
import { FlightOfferRow } from "./flight-offer-row.js"
import { FlightSearchForm } from "./flight-search-form.js"
import type { FlightsPageProps, FlowStage } from "./flights-page-types.js"

export type {
  FlightBookingNavigationTarget,
  FlightsPageProps,
  FlightsPageSearchChangeOptions,
  FlightsPageSearchParams,
} from "./flights-page-types.js"

import {
  CacheColdBanner,
  hasActiveFilters,
  NoResults,
  PickedLegBanner,
  ReadyToBookPanel,
} from "./flights-page-panels.js"
import {
  composeRequest,
  EMPTY_REQUEST_FOR_DISABLED,
  legHeading,
  PAGE_SIZE,
  readOfferFromCache,
  selectLabel,
  urlToBaseRequest,
  urlToFilters,
} from "./flights-page-utils.js"
import { DEFAULT_POPULAR_ROUTES, PopularRoutes } from "./popular-routes.js"

export function FlightsPage({
  search,
  onSearchChange,
  onBookOffer,
  routes = DEFAULT_POPULAR_ROUTES,
  className,
}: FlightsPageProps) {
  const messages = useFlightsUiMessagesOrDefault().flightsPage
  const qc = useQueryClient()
  const [openOffer, setOpenOffer] = useState<FlightOffer | null>(null)

  const isRoundTrip = (search.tripType ?? "round_trip") === "round_trip"
  const stage: FlowStage = (() => {
    if (!isRoundTrip) return "outbound"
    if (!search.outboundOfferId) return "outbound"
    if (!search.returnOfferId) return "return"
    return "ready"
  })()

  const outboundOffer = useMemo(
    () => (search.outboundOfferId ? readOfferFromCache(qc, search.outboundOfferId) : null),
    [search.outboundOfferId, qc],
  )
  const returnOffer = useMemo(
    () => (search.returnOfferId ? readOfferFromCache(qc, search.returnOfferId) : null),
    [search.returnOfferId, qc],
  )

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const airline of airlinesQuery.data?.data ?? []) {
      map.set(airline.iataCode, airline.name)
    }
    return map
  }, [airlinesQuery.data])
  const airportMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const airport of airportsQuery.data?.data ?? []) {
      map.set(airport.iataCode, `${airport.city} (${airport.iataCode})`)
    }
    return map
  }, [airportsQuery.data])
  const carrierName = (code: string) => carrierMap.get(code)
  const airportName = (code: string) => airportMap.get(code)

  const baseRequest = useMemo(
    () => urlToBaseRequest(search, stage === "ready" ? "outbound" : stage),
    [search, stage],
  )
  const filters = useMemo(() => urlToFilters(search), [search])
  const searchEnabled = baseRequest != null && stage !== "ready"
  const request = useMemo(
    () =>
      baseRequest && stage !== "ready"
        ? composeRequest(baseRequest, filters, search.page ?? 1)
        : null,
    [baseRequest, filters, search.page, stage],
  )

  const flightSearchQuery = useFlightSearch(request ?? EMPTY_REQUEST_FOR_DISABLED, {
    enabled: searchEnabled,
  })
  const offers = flightSearchQuery.data?.offers ?? []
  const meta = flightSearchQuery.data?.pagination
  const total = meta?.total ?? offers.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = search.page ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const passengers = useMemo<PassengerCounts>(
    () => ({
      adults: search.pax_a ?? 1,
      children: search.pax_c ?? 0,
      infants: search.pax_i ?? 0,
    }),
    [search.pax_a, search.pax_c, search.pax_i],
  )
  const cabin = search.cabin ?? "economy"

  const pickOffer = (offer: FlightOffer) => {
    qc.setQueryData(flightsQueryKeys.offerDetail(offer.offerId), { offer })

    if (!isRoundTrip) {
      onBookOffer({
        outboundOfferId: offer.offerId,
        passengers,
        cabin,
      })
      return
    }

    if (stage === "outbound") {
      onSearchChange({
        ...search,
        leg: "return",
        outboundOfferId: offer.offerId,
        returnOfferId: undefined,
        page: 1,
      })
      return
    }

    if (stage === "return") {
      onSearchChange({
        ...search,
        returnOfferId: offer.offerId,
      })
    }
  }

  const proceedToBooking = () => {
    if (!search.outboundOfferId) return
    onBookOffer({
      outboundOfferId: search.outboundOfferId,
      returnOfferId: search.returnOfferId,
      passengers,
      cabin,
    })
  }

  const changeOutbound = () => {
    onSearchChange({
      ...search,
      leg: "outbound",
      outboundOfferId: undefined,
      returnOfferId: undefined,
      page: 1,
    })
  }

  const changeReturn = () => {
    onSearchChange({
      ...search,
      leg: "return",
      returnOfferId: undefined,
      page: 1,
    })
  }

  const handleSubmit = (next: FlightSearchRequest) => {
    const first = next.slices[0]
    const second = next.slices[1]
    onSearchChange({
      tripType: next.slices.length === 2 ? "round_trip" : "one_way",
      from: first?.origin,
      to: first?.destination,
      depart: first?.departureDate,
      ret: second?.departureDate,
      pax_a: next.passengers.adults,
      pax_c: next.passengers.children ?? 0,
      pax_i: next.passengers.infants ?? 0,
      cabin: next.cabin ?? "economy",
      leg: "outbound",
      outboundOfferId: undefined,
      returnOfferId: undefined,
      page: 1,
    })
  }

  const handleFiltersChange = (nextFilters: FlightFiltersValue) => {
    onSearchChange(
      {
        ...search,
        carriers: nextFilters.carriers.length > 0 ? nextFilters.carriers : undefined,
        maxStops: nextFilters.maxStops ?? undefined,
        maxPrice: nextFilters.maxPrice ?? undefined,
        page: 1,
      },
      { replace: true },
    )
  }

  const setPage = (next: number) => {
    onSearchChange({ ...search, page: next }, { replace: true })
  }

  const formInitial = useMemo(() => {
    if (!search.from || !search.to || !search.depart) return undefined
    const slices = [{ origin: search.from, destination: search.to, departureDate: search.depart }]
    if (isRoundTrip && search.ret) {
      slices.push({ origin: search.to, destination: search.from, departureDate: search.ret })
    }
    return {
      slices,
      passengers,
      cabin,
      tripType: search.tripType,
    }
  }, [
    cabin,
    isRoundTrip,
    passengers,
    search.depart,
    search.from,
    search.ret,
    search.to,
    search.tripType,
  ])

  const hasSearchInput = baseRequest != null

  return (
    <div className={cn("mx-auto flex w-full max-w-screen-2xl flex-col gap-5", className)}>
      <header>
        <h1 className="font-semibold text-2xl">{messages.title}</h1>
        <p className="text-muted-foreground text-sm">{messages.description}</p>
      </header>

      <FlightSearchForm
        key={
          hasSearchInput
            ? `${search.from}-${search.to}-${search.depart}-${search.ret ?? ""}`
            : "empty"
        }
        onSearch={handleSubmit}
        loading={flightSearchQuery.isFetching}
        initial={formInitial}
      />

      {!hasSearchInput && <PopularRoutes routes={routes} onSelect={handleSubmit} />}

      {stage === "ready" && outboundOffer && returnOffer && (
        <ReadyToBookPanel
          outbound={outboundOffer}
          returnLeg={returnOffer}
          carrierName={carrierName}
          airportName={airportName}
          onChangeOutbound={changeOutbound}
          onChangeReturn={changeReturn}
          onContinue={proceedToBooking}
        />
      )}

      {stage === "ready" && (!outboundOffer || !returnOffer) && (
        <CacheColdBanner message={messages.pickedOfferMissing} onReset={changeOutbound} />
      )}

      {stage === "return" && !outboundOffer && (
        <CacheColdBanner message={messages.outboundOfferMissing} onReset={changeOutbound} />
      )}

      {hasSearchInput && stage !== "ready" && flightSearchQuery.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
          {flightSearchQuery.error instanceof Error
            ? flightSearchQuery.error.message
            : messages.searchFailed}
        </div>
      )}

      {hasSearchInput && stage !== "ready" && !flightSearchQuery.isError && (
        <>
          <FlightFiltersBar
            value={filters}
            onChange={handleFiltersChange}
            offers={offers}
            carrierName={carrierName}
          />

          {stage === "return" && outboundOffer && (
            <PickedLegBanner
              label={messages.selectedOutbound}
              offer={outboundOffer}
              carrierName={carrierName}
              airportName={airportName}
              onChange={changeOutbound}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium text-base">
              {legHeading(messages, stage, isRoundTrip, search.from, search.to)}
            </h2>
            <span className="text-muted-foreground text-sm">
              {flightSearchQuery.isFetching
                ? messages.searching
                : total === 0
                  ? messages.zeroOffers
                  : formatMessage(messages.offersSummary, {
                      start: String(rangeStart),
                      end: String(rangeEnd),
                      total: String(total),
                      plural: total === 1 ? "" : "s",
                    })}
            </span>
          </div>

          {flightSearchQuery.isFetching ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable identity. -- owner: flights-react; existing suppression is intentional pending typed cleanup.
                <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
              ))}
            </div>
          ) : offers.length === 0 ? (
            <NoResults hasFilters={hasActiveFilters(filters)} />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {offers.map((offer) => (
                  <FlightOfferRow
                    key={offer.offerId}
                    offer={offer}
                    carrierName={carrierName}
                    onClick={(nextOffer) => setOpenOffer(nextOffer)}
                    onSelect={pickOffer}
                    selectLabel={selectLabel(messages, stage, isRoundTrip)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm">
                    {formatMessage(messages.pageSummary, {
                      page: String(page),
                      totalPages: String(totalPages),
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      {messages.previous}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages || meta?.hasMore === false}
                    >
                      {messages.next}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Sheet
        open={openOffer != null}
        onOpenChange={(open) => {
          if (!open) setOpenOffer(null)
        }}
      >
        <SheetContent className="w-full p-0 sm:max-w-2xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Plane className="h-4 w-4" />
                {messages.flightOffer}
                {openOffer?.validatingCarrier && (
                  <Badge variant="secondary">{openOffer.validatingCarrier}</Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {openOffer && (
                <FlightOfferDetail
                  offer={openOffer}
                  carrierName={carrierName}
                  airportName={airportName}
                />
              )}
            </div>
            {openOffer && (
              <SheetFooter className="border-t bg-muted/20 px-6 py-3">
                <div className="flex w-full items-center justify-end gap-2">
                  <Button
                    onClick={() => {
                      const offer = openOffer
                      setOpenOffer(null)
                      pickOffer(offer)
                    }}
                  >
                    {selectLabel(messages, stage, isRoundTrip)}
                  </Button>
                </div>
              </SheetFooter>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
