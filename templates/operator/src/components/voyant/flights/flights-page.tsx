"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { FlightOffer, FlightSearchRequest } from "@voyantjs/flights/contract/types"
import {
  flightsQueryKeys,
  useAirlines,
  useAirports,
  useFlightSearch,
} from "@voyantjs/flights-react"
import {
  DEFAULT_POPULAR_ROUTES,
  FlightFiltersBar,
  type FlightFiltersValue,
  FlightItinerary,
  FlightOfferDetail,
  FlightOfferRow,
  FlightSearchForm,
  PopularRoutes,
} from "@voyantjs/flights-ui"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { ChevronLeft, ChevronRight, Pencil, Plane } from "lucide-react"
import { useMemo, useState } from "react"

import { type FlightsSearchParams, Route } from "@/routes/_workspace/flights"

const PAGE_SIZE = 20

type FlowStage = "outbound" | "return" | "ready"

export function FlightsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const routerNavigate = useNavigate()
  const qc = useQueryClient()
  const [openOffer, setOpenOffer] = useState<FlightOffer | null>(null)

  const isRoundTrip = (search.tripType ?? "round_trip") === "round_trip"
  const stage: FlowStage = (() => {
    if (!isRoundTrip) return "outbound"
    if (!search.outboundOfferId) return "outbound"
    if (!search.returnOfferId) return "return"
    return "ready"
  })()

  // Cached offers from prior picks. Both survive client-side navigation but
  // not a full reload — if the cache is cold we bounce back to the picker.
  const outboundOffer = useMemo(
    () => (search.outboundOfferId ? readOfferFromCache(qc, search.outboundOfferId) : null),
    [search.outboundOfferId, qc],
  )
  const returnOffer = useMemo(
    () => (search.returnOfferId ? readOfferFromCache(qc, search.returnOfferId) : null),
    [search.returnOfferId, qc],
  )

  // Reference data resolvers used by row + detail rendering.
  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of airlinesQuery.data?.data ?? []) m.set(a.iataCode, a.name)
    return m
  }, [airlinesQuery.data])
  const airportMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of airportsQuery.data?.data ?? []) m.set(a.iataCode, `${a.city} (${a.iataCode})`)
    return m
  }, [airportsQuery.data])
  const carrierName = (code: string) => carrierMap.get(code)
  const airportName = (code: string) => airportMap.get(code)

  // Per-leg search request. Each leg is its own one-way search so the user
  // picks outbound then return — same model as Wizz/Ryanair/most LCCs.
  const baseRequest = useMemo(
    () => urlToBaseRequest(search, stage === "ready" ? "outbound" : stage),
    [search, stage],
  )
  const filters = useMemo(() => urlToFilters(search), [search])
  // Disable the search query in the "ready" stage — the trip summary view
  // doesn't need offers.
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

  // ── Pick handlers ───────────────────────────────────────────────────────

  /**
   * User picked an offer. Three branches:
   *   - one-way → go straight to /book
   *   - round-trip + outbound stage → flip to "return" stage
   *   - round-trip + return stage → flip to "ready" stage (don't navigate yet)
   *     The Continue CTA in the trip-ready panel is what fires the booking
   *     navigation.
   */
  const pickOffer = (offer: FlightOffer) => {
    qc.setQueryData(flightsQueryKeys.offerDetail(offer.offerId), { offer })

    if (!isRoundTrip) {
      routerNavigate({
        to: "/flights/book/$offerId",
        params: { offerId: offer.offerId },
        search: {
          pax_a: search.pax_a ?? 1,
          pax_c: search.pax_c ?? 0,
          pax_i: search.pax_i ?? 0,
          cabin: search.cabin ?? "economy",
        },
      })
      return
    }

    if (stage === "outbound") {
      navigate({
        search: (prev): FlightsSearchParams => ({
          ...prev,
          leg: "return",
          outboundOfferId: offer.offerId,
          returnOfferId: undefined,
          page: 1,
        }),
        replace: false,
      })
      return
    }

    if (stage === "return") {
      navigate({
        search: (prev): FlightsSearchParams => ({
          ...prev,
          returnOfferId: offer.offerId,
        }),
        replace: false,
      })
      return
    }
  }

  const proceedToBooking = () => {
    if (!search.outboundOfferId) return
    routerNavigate({
      to: "/flights/book/$offerId",
      params: { offerId: search.outboundOfferId },
      search: {
        ...(search.returnOfferId ? { return: search.returnOfferId } : {}),
        pax_a: search.pax_a ?? 1,
        pax_c: search.pax_c ?? 0,
        pax_i: search.pax_i ?? 0,
        cabin: search.cabin ?? "economy",
      },
    })
  }

  const changeOutbound = () => {
    navigate({
      search: (prev): FlightsSearchParams => ({
        ...prev,
        leg: "outbound",
        outboundOfferId: undefined,
        returnOfferId: undefined,
        page: 1,
      }),
      replace: false,
    })
  }

  const changeReturn = () => {
    navigate({
      search: (prev): FlightsSearchParams => ({
        ...prev,
        leg: "return",
        returnOfferId: undefined,
        page: 1,
      }),
      replace: false,
    })
  }

  // ── URL writers ─────────────────────────────────────────────────────────

  const handleSubmit = (next: FlightSearchRequest) => {
    const first = next.slices[0]
    const second = next.slices[1]
    navigate({
      search: (): FlightsSearchParams => ({
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
      }),
      replace: false,
    })
  }

  const handleFiltersChange = (nextFilters: FlightFiltersValue) => {
    navigate({
      search: (prev): FlightsSearchParams => ({
        ...prev,
        carriers: nextFilters.carriers.length > 0 ? nextFilters.carriers : undefined,
        maxStops: nextFilters.maxStops ?? undefined,
        maxPrice: nextFilters.maxPrice ?? undefined,
        page: 1,
      }),
      replace: true,
    })
  }

  const setPage = (next: number) => {
    navigate({
      search: (prev): FlightsSearchParams => ({ ...prev, page: next }),
      replace: true,
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────

  // Form initial values — derived from the URL.
  const formInitial = useMemo(() => {
    if (!search.from || !search.to || !search.depart) return undefined
    const slices = [{ origin: search.from, destination: search.to, departureDate: search.depart }]
    if (isRoundTrip && search.ret) {
      slices.push({ origin: search.to, destination: search.from, departureDate: search.ret })
    }
    return {
      slices,
      passengers: {
        adults: search.pax_a ?? 1,
        children: search.pax_c ?? 0,
        infants: search.pax_i ?? 0,
      },
      cabin: search.cabin ?? "economy",
      tripType: search.tripType,
    }
  }, [
    isRoundTrip,
    search.cabin,
    search.depart,
    search.from,
    search.pax_a,
    search.pax_c,
    search.pax_i,
    search.ret,
    search.to,
    search.tripType,
  ])

  const hasSearchInput = baseRequest != null

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-6 py-6 lg:px-8">
      <header>
        <h1 className="font-semibold text-2xl">Flights</h1>
        <p className="text-muted-foreground text-sm">
          Search live flight offers across configured connectors.
        </p>
      </header>

      <FlightSearchForm
        // Force a remount when the URL search criteria change so the form
        // re-initializes from the new params (handles back/forward + popular
        // route clicks).
        key={
          hasSearchInput
            ? `${search.from}-${search.to}-${search.depart}-${search.ret ?? ""}`
            : "empty"
        }
        onSearch={handleSubmit}
        loading={flightSearchQuery.isFetching}
        initial={formInitial}
      />

      {!hasSearchInput && <PopularRoutes routes={DEFAULT_POPULAR_ROUTES} onSelect={handleSubmit} />}

      {/* "Ready to book" stage — both legs picked. Show the trip summary
          + Continue CTA, hide the filters/results entirely. */}
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

      {/* Either leg's offer dropped from the cache (refresh while in the
          ready or return stage) — bounce back to the picker. */}
      {stage === "ready" && (!outboundOffer || !returnOffer) && (
        <CacheColdBanner
          message="One of your picked offers isn't in your session anymore."
          onReset={changeOutbound}
        />
      )}

      {stage === "return" && !outboundOffer && (
        <CacheColdBanner
          message="The outbound offer isn't in your session anymore."
          onReset={changeOutbound}
        />
      )}

      {hasSearchInput && stage !== "ready" && flightSearchQuery.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
          {flightSearchQuery.error instanceof Error
            ? flightSearchQuery.error.message
            : "Search failed."}
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

          {/* Outbound summary banner — sits BELOW the filters, ABOVE the
              return offers. Filters apply to the return list, not the
              already-picked outbound. */}
          {stage === "return" && outboundOffer && (
            <PickedLegBanner
              label="Outbound selected"
              offer={outboundOffer}
              carrierName={carrierName}
              airportName={airportName}
              onChange={changeOutbound}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium text-base">
              {legHeading(stage, isRoundTrip, search.from, search.to)}
            </h2>
            <span className="text-muted-foreground text-sm">
              {flightSearchQuery.isFetching
                ? "Searching…"
                : total === 0
                  ? "0 offers"
                  : `${rangeStart}–${rangeEnd} of ${total} offer${total === 1 ? "" : "s"}`}
            </span>
          </div>

          {flightSearchQuery.isFetching ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
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
                    onClick={(o) => setOpenOffer(o)}
                    onSelect={pickOffer}
                    selectLabel={selectLabel(stage, isRoundTrip)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages || meta?.hasMore === false}
                    >
                      Next <ChevronRight className="ml-1 h-4 w-4" />
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
                Flight offer
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
                      const o = openOffer
                      setOpenOffer(null)
                      pickOffer(o)
                    }}
                  >
                    {selectLabel(stage, isRoundTrip)}
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

// ─────────────────────────────────────────────────────────────────────────────

function PickedLegBanner({
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
  const itin = offer.itineraries[0]
  if (!itin) return null
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-medium text-[11px] uppercase tracking-wider text-emerald-700">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-base tabular-nums">
            {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency)}
          </span>
          <Button variant="ghost" size="sm" onClick={onChange}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Change
          </Button>
        </div>
      </div>
      <FlightItinerary
        itinerary={itin}
        compact
        carrierName={carrierName}
        airportName={airportName}
      />
    </div>
  )
}

function ReadyToBookPanel({
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
  const total = Number(outbound.totalPrice.amount) + Number(returnLeg.totalPrice.amount)
  const currency = outbound.totalPrice.currency
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <PickedLegBanner
          label="Outbound selected"
          offer={outbound}
          carrierName={carrierName}
          airportName={airportName}
          onChange={onChangeOutbound}
        />
        <PickedLegBanner
          label="Return selected"
          offer={returnLeg}
          carrierName={carrierName}
          airportName={airportName}
          onChange={onChangeReturn}
        />
      </div>
      <div className="flex flex-col items-stretch gap-3 rounded-xl border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
            Trip total
          </span>
          <span className="font-semibold text-2xl tabular-nums">
            {formatMoney(total.toFixed(2), currency)}
          </span>
          <span className="text-muted-foreground text-xs">Both legs · taxes included</span>
        </div>
        <Button size="lg" onClick={onContinue} className="md:px-8">
          Continue to booking
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}

function CacheColdBanner({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-md border border-dashed bg-card p-6 text-center text-muted-foreground text-sm">
      <p>{message}</p>
      <Button className="mt-3" variant="outline" onClick={onReset}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        Pick outbound again
      </Button>
    </div>
  )
}

function legHeading(stage: FlowStage, isRoundTrip: boolean, from?: string, to?: string): string {
  if (!isRoundTrip) return "Available flights"
  if (stage === "outbound") return `Outbound · ${from ?? "?"} → ${to ?? "?"}`
  if (stage === "return") return `Return · ${to ?? "?"} → ${from ?? "?"}`
  return "Trip"
}

function selectLabel(stage: FlowStage, isRoundTrip: boolean): string {
  if (!isRoundTrip) return "Book this flight"
  if (stage === "outbound") return "Select outbound"
  if (stage === "return") return "Select return"
  return "Continue to booking"
}

function NoResults({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
      {hasFilters
        ? "No offers match the current filters."
        : "No flights found for this route on this date."}
    </div>
  )
}

function hasActiveFilters(f: FlightFiltersValue): boolean {
  return f.carriers.length > 0 || f.maxStops != null || f.maxPrice != null
}

function readOfferFromCache(
  qc: ReturnType<typeof useQueryClient>,
  offerId: string,
): FlightOffer | null {
  const cached = qc.getQueryData<{ offer: FlightOffer }>(flightsQueryKeys.offerDetail(offerId))
  return cached?.offer ?? null
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

// ─────────────────────────────────────────────────────────────────────────────
// URL ↔ request adapters
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_REQUEST_FOR_DISABLED: FlightSearchRequest = {
  slices: [],
  passengers: { adults: 1 },
  cabin: "economy",
}

/**
 * Reconstruct the per-leg search request from URL search params. Returns
 * `null` when the URL doesn't carry a complete search (no origin /
 * destination / depart date) — caller renders the popular-routes empty
 * state. For round-trip + leg=return, builds a reverse one-way search using
 * the `ret` date.
 */
function urlToBaseRequest(
  search: FlightsSearchParams,
  leg: "outbound" | "return",
): FlightSearchRequest | null {
  if (!search.from || !search.to || !search.depart) return null
  const isRoundTrip = (search.tripType ?? "round_trip") === "round_trip"
  if (leg === "return" && (!isRoundTrip || !search.ret)) return null

  const slice =
    leg === "outbound"
      ? { origin: search.from, destination: search.to, departureDate: search.depart }
      : { origin: search.to, destination: search.from, departureDate: search.ret as string }

  return {
    slices: [slice],
    passengers: {
      adults: search.pax_a ?? 1,
      children: search.pax_c ?? 0,
      infants: search.pax_i ?? 0,
    },
    cabin: search.cabin ?? "economy",
  }
}

function urlToFilters(search: FlightsSearchParams): FlightFiltersValue {
  return {
    carriers: search.carriers ?? [],
    maxStops: search.maxStops ?? null,
    maxPrice: search.maxPrice ?? null,
  }
}

function composeRequest(
  base: FlightSearchRequest,
  filters: FlightFiltersValue,
  page: number,
): FlightSearchRequest {
  const searchOptions: FlightSearchRequest["searchOptions"] = {}
  if (filters.carriers.length > 0) searchOptions.includeCarriers = filters.carriers
  if (filters.maxStops === 0) searchOptions.directOnly = true
  else if (filters.maxStops != null) searchOptions.maxStops = filters.maxStops
  if (filters.maxPrice != null) searchOptions.maxPrice = filters.maxPrice

  return {
    ...base,
    ...(Object.keys(searchOptions).length > 0 ? { searchOptions } : {}),
    pagination: {
      limit: PAGE_SIZE,
      ...(page > 1 ? { cursor: String(page) } : {}),
    },
  }
}
