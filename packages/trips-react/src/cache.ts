"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { PriceTripResult, ReserveTripResult, StartCheckoutResult } from "@voyantjs/trips"

import { tripsQueryKeys } from "./query-keys.js"

type TripLikeResult = Pick<
  PriceTripResult | ReserveTripResult | StartCheckoutResult,
  "envelope" | "components"
>

export function writeTripCache(queryClient: QueryClient, result: TripLikeResult) {
  void queryClient.invalidateQueries({ queryKey: tripsQueryKeys.trips() })
  queryClient.setQueryData(tripsQueryKeys.trip(result.envelope.id), {
    envelope: result.envelope,
    components: result.components,
  })
  queryClient.setQueryData(tripsQueryKeys.components(result.envelope.id), result.components)
}

export function writePriceTripCache(queryClient: QueryClient, result: PriceTripResult) {
  writeTripCache(queryClient, result)
  queryClient.setQueryData(tripsQueryKeys.pricing(result.envelope.id), result.pricing)
}

export function writeReserveTripCache(queryClient: QueryClient, result: ReserveTripResult) {
  writeTripCache(queryClient, result)
}

export function writeTripCheckoutCache(queryClient: QueryClient, result: StartCheckoutResult) {
  writeTripCache(queryClient, result)
  queryClient.setQueryData(tripsQueryKeys.checkout(result.envelope.id), result.target)
}
