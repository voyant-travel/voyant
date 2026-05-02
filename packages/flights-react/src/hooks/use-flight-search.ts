"use client"

import { useQuery } from "@tanstack/react-query"
import type { FlightSearchRequest } from "@voyantjs/flights/contract/types"

import { useVoyantFlightsContext } from "../provider.js"
import { getFlightSearchQueryOptions } from "../query-options.js"

export interface UseFlightSearchOptions {
  /** Disable the query — useful while the form is incomplete. */
  enabled?: boolean
  /** TanStack Query stale time, milliseconds. Default 30s. */
  staleTime?: number
}

/**
 * POST `/v1/admin/flights/search`. Re-runs whenever the request changes.
 * Disabled by default until the form is complete (no slices, etc.) — pass
 * `enabled: true` once the request is ready to fire.
 */
export function useFlightSearch(
  request: FlightSearchRequest,
  options: UseFlightSearchOptions = {},
) {
  const client = useVoyantFlightsContext()
  const { enabled = false, staleTime = 30_000 } = options
  return useQuery({
    ...getFlightSearchQueryOptions(client, request),
    enabled: enabled && request.slices.length > 0 && request.passengers.adults > 0,
    staleTime,
  })
}
