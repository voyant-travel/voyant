"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFlightsContext } from "../provider.js"
import type { AirportSearchFilters } from "../query-keys.js"
import { getAirportsQueryOptions } from "../query-options.js"

export interface UseAirportsOptions extends AirportSearchFilters {
  enabled?: boolean
}

/**
 * Fetch the airport reference list. Use the `q` filter for substring
 * search (city / IATA / name). Cached per-filter.
 */
export function useAirports(options: UseAirportsOptions = {}) {
  const client = useVoyantFlightsContext()
  const { enabled = true, ...filters } = options
  return useQuery({
    ...getAirportsQueryOptions(client, filters),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
