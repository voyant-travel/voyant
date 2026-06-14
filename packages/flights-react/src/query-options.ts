"use client"

import { queryOptions } from "@tanstack/react-query"
import type { FlightOffer, FlightSearchRequest } from "@voyant-travel/flights/contract/types"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import { type AirportSearchFilters, flightsQueryKeys } from "./query-keys.js"
import {
  aircraftListResponseSchema,
  airlineListResponseSchema,
  airportListResponseSchema,
  ancillaryResponseSchema,
  flightSearchResponseSchema,
  seatMapResponseSchema,
} from "./schemas.js"

export function getFlightSearchQueryOptions(
  client: FetchWithValidationOptions,
  request: FlightSearchRequest,
) {
  return queryOptions({
    queryKey: flightsQueryKeys.searchRequest(request),
    queryFn: () =>
      fetchWithValidation("/v1/admin/flights/search", flightSearchResponseSchema, client, {
        method: "POST",
        body: JSON.stringify(request),
      }),
  })
}

export function getFlightAncillariesQueryOptions(
  client: FetchWithValidationOptions,
  input: { offerId: string; offer?: FlightOffer },
) {
  return queryOptions({
    queryKey: flightsQueryKeys.ancillariesForOffer(input.offerId),
    queryFn: () =>
      fetchWithValidation("/v1/admin/flights/ancillaries", ancillaryResponseSchema, client, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  })
}

export function getFlightSeatMapQueryOptions(
  client: FetchWithValidationOptions,
  input: { offerId: string; segmentId: string; offer?: FlightOffer },
) {
  return queryOptions({
    queryKey: flightsQueryKeys.seatMapForSegment(input.offerId, input.segmentId),
    queryFn: () =>
      fetchWithValidation("/v1/admin/flights/seatmap", seatMapResponseSchema, client, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  })
}

export function getAirlinesQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: flightsQueryKeys.airlines(),
    queryFn: () =>
      fetchWithValidation(
        "/v1/admin/flights/reference/airlines",
        airlineListResponseSchema,
        client,
      ),
  })
}

export function getAirportsQueryOptions(
  client: FetchWithValidationOptions,
  filters: AirportSearchFilters = {},
) {
  return queryOptions({
    queryKey: flightsQueryKeys.airports(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.q) params.set("q", filters.q)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/flights/reference/airports${qs ? `?${qs}` : ""}`,
        airportListResponseSchema,
        client,
      )
    },
  })
}

export function getAircraftQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: flightsQueryKeys.aircraft(),
    queryFn: () =>
      fetchWithValidation(
        "/v1/admin/flights/reference/aircraft",
        aircraftListResponseSchema,
        client,
      ),
  })
}
