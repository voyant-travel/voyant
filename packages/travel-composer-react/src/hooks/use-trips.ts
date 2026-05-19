"use client"

import { useQuery } from "@tanstack/react-query"

import type { ListTripsParams } from "../operations.js"
import { useVoyantTravelComposerContext } from "../provider.js"
import { listTripsQueryOptions } from "../query-options.js"

export interface UseTripsOptions {
  enabled?: boolean
}

export function useTrips(params: ListTripsParams = {}, options: UseTripsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  const { enabled = true } = options

  return useQuery({
    ...listTripsQueryOptions({ baseUrl, fetcher }, params),
    enabled,
  })
}
