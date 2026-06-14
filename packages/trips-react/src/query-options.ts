"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import { getTrip, type ListTripsParams, listTrips } from "./operations.js"
import { tripsQueryKeys } from "./query-keys.js"

export function listTripsQueryOptions(
  client: FetchWithValidationOptions,
  params: ListTripsParams = {},
) {
  return queryOptions({
    queryKey: tripsQueryKeys.tripList(params),
    queryFn: () => listTrips(client, params),
  })
}

export function getTripQueryOptions(client: FetchWithValidationOptions, envelopeId: string) {
  return queryOptions({
    queryKey: tripsQueryKeys.trip(envelopeId),
    queryFn: () => getTrip(client, envelopeId),
  })
}

export function getTripComponentsQueryOptions(
  client: FetchWithValidationOptions,
  envelopeId: string,
) {
  return queryOptions({
    queryKey: tripsQueryKeys.components(envelopeId),
    queryFn: () => getTrip(client, envelopeId).then((trip) => trip.components),
  })
}
