import type { QueryClient } from "@tanstack/react-query"
import type { FlightOffer, FlightSearchRequest } from "@voyantjs/flights/contract/types"
import { formatMessage } from "@voyantjs/i18n"
import type { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import { flightsQueryKeys } from "../index.js"
import { EMPTY_FLIGHT_FILTERS, type FlightFiltersValue } from "./flight-filters-bar.js"
import type { FlightsPageSearchParams, FlowStage } from "./flights-page-types.js"

export const PAGE_SIZE = 20

export const EMPTY_REQUEST_FOR_DISABLED: FlightSearchRequest = {
  slices: [],
  passengers: { adults: 1 },
  cabin: "economy",
}

export function legHeading(
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>["flightsPage"],
  stage: FlowStage,
  isRoundTrip: boolean,
  from?: string,
  to?: string,
): string {
  if (!isRoundTrip) return messages.availableFlights
  if (stage === "outbound") {
    return formatMessage(messages.outboundHeading, { from: from ?? "?", to: to ?? "?" })
  }
  if (stage === "return") {
    return formatMessage(messages.returnHeading, { from: to ?? "?", to: from ?? "?" })
  }
  return messages.tripHeading
}

export function selectLabel(
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>["flightsPage"],
  stage: FlowStage,
  isRoundTrip: boolean,
): string {
  if (!isRoundTrip) return messages.bookThisFlight
  if (stage === "outbound") return messages.selectOutbound
  if (stage === "return") return messages.selectReturn
  return messages.continueToBooking
}

export function readOfferFromCache(qc: QueryClient, offerId: string): FlightOffer | null {
  const cached = qc.getQueryData<{ offer: FlightOffer }>(flightsQueryKeys.offerDetail(offerId))
  return cached?.offer ?? null
}

export function urlToBaseRequest(
  search: FlightsPageSearchParams,
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

export function urlToFilters(search: FlightsPageSearchParams): FlightFiltersValue {
  return {
    ...EMPTY_FLIGHT_FILTERS,
    carriers: search.carriers ?? [],
    maxStops: search.maxStops ?? null,
    maxPrice: search.maxPrice ?? null,
  }
}

export function composeRequest(
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
