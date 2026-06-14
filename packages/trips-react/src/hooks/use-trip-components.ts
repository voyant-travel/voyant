"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantTripsContext } from "../provider.js"
import { getTripComponentsQueryOptions } from "../query-options.js"

export interface UseTripComponentsOptions {
  enabled?: boolean
}

export function useTripComponents(
  envelopeId: string | null | undefined,
  options: UseTripComponentsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantTripsContext()
  const { enabled = true } = options
  const id = envelopeId ?? ""

  return useQuery({
    ...getTripComponentsQueryOptions({ baseUrl, fetcher }, id),
    enabled: enabled && Boolean(envelopeId),
  })
}
