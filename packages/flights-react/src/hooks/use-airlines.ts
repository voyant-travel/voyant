"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantFlightsContext } from "../provider.js"
import { getAirlinesQueryOptions } from "../query-options.js"

/**
 * Fetches the full airline reference list. Long-stale because airlines
 * rarely change once seeded — the operator's reference table is a
 * deliberate snapshot, not a live feed.
 */
export function useAirlines(options: { enabled?: boolean } = {}) {
  const client = useVoyantFlightsContext()
  const { enabled = true } = options
  return useQuery({
    ...getAirlinesQueryOptions(client),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
