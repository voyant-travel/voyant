"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantTripsContext } from "../provider.js"
import { getTripQueryOptions } from "../query-options.js"

export interface UseTripOptions {
  enabled?: boolean
}

export function useTrip(envelopeId: string | null | undefined, options: UseTripOptions = {}) {
  const { baseUrl, fetcher } = useVoyantTripsContext()
  const { enabled = true } = options
  const id = envelopeId ?? ""

  return useQuery({
    ...getTripQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(envelopeId),
  })
}
