"use client"

import { queryOptions } from "@tanstack/react-query"

import type { FetchWithValidationOptions } from "./client.js"
import { getTrip, type ListTripsParams, listTrips } from "./operations.js"
import { travelComposerQueryKeys } from "./query-keys.js"

export function listTripsQueryOptions(
  client: FetchWithValidationOptions,
  params: ListTripsParams = {},
) {
  return queryOptions({
    queryKey: travelComposerQueryKeys.tripList(params),
    queryFn: () => listTrips(client, params),
  })
}

export function getTripQueryOptions(client: FetchWithValidationOptions, envelopeId: string) {
  return queryOptions({
    queryKey: travelComposerQueryKeys.trip(envelopeId),
    queryFn: () => getTrip(client, envelopeId),
  })
}

export function getTripComponentsQueryOptions(
  client: FetchWithValidationOptions,
  envelopeId: string,
) {
  return queryOptions({
    queryKey: travelComposerQueryKeys.components(envelopeId),
    queryFn: () => getTrip(client, envelopeId).then((trip) => trip.components),
  })
}
