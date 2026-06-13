"use client"

import { useQuery } from "@tanstack/react-query"

import type { ListTripsParams } from "../operations.js"
import { useVoyantTripComposerContext } from "../provider.js"
import { listTripsQueryOptions } from "../query-options.js"

export interface UseTripsOptions {
  enabled?: boolean
}

export function useTrips(params: ListTripsParams = {}, options: UseTripsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantTripComposerContext()
  const { enabled = true } = options

  return useQuery({
    ...listTripsQueryOptions({ baseUrl, fetcher }, params),
    enabled,
  })
}
