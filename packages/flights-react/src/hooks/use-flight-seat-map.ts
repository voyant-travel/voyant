"use client"

import { useQuery } from "@tanstack/react-query"
import type { FlightOffer } from "@voyantjs/flights/contract/types"

import { useVoyantFlightsContext } from "../provider.js"
import { getFlightSeatMapQueryOptions } from "../query-options.js"

export interface UseFlightSeatMapOptions {
  /** Disable the query — useful before the offer is re-priced or the user enters the seats step. */
  enabled?: boolean
  /** TanStack Query stale time, milliseconds. Default 5 minutes. */
  staleTime?: number
}

/**
 * POST `/v1/admin/flights/seatmap` — fetches the seat map for one segment
 * of an offer. Maps are per-segment because layouts differ by aircraft and
 * cabin (a multi-stop itinerary may use different equipment per leg).
 *
 * Default `enabled = false` so callers gate fetching on the user actually
 * entering the seat selection step. When the connector doesn't declare
 * `flight/seatmap`, the API returns 501 — propagated as a query error.
 */
export function useFlightSeatMap(
  input: { offerId: string; segmentId: string; offer?: FlightOffer } | null,
  options: UseFlightSeatMapOptions = {},
) {
  const client = useVoyantFlightsContext()
  const { enabled = false, staleTime = 5 * 60_000 } = options
  const safeInput = input ?? { offerId: "", segmentId: "" }
  return useQuery({
    ...getFlightSeatMapQueryOptions(client, safeInput),
    enabled: enabled && !!input?.offerId && !!input?.segmentId,
    staleTime,
  })
}
