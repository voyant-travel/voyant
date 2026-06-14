"use client"

import { useQuery } from "@tanstack/react-query"
import type { FlightOffer } from "@voyant-travel/flights/contract/types"

import { useVoyantFlightsContext } from "../provider.js"
import { getFlightAncillariesQueryOptions } from "../query-options.js"

export interface UseFlightAncillariesOptions {
  /** Disable the query — useful before the offer is re-priced. */
  enabled?: boolean
  /** TanStack Query stale time, milliseconds. Default 5 minutes. */
  staleTime?: number
}

/**
 * POST `/v1/admin/flights/ancillaries` — fetches the bag/assistance/extras
 * catalog for an offer. Catalog is offer-scoped; in the per-leg booking
 * flow callers fire one query per leg and merge the picks at book time
 * via `FlightBookRequest.ancillaries`.
 *
 * Default `enabled = false` so callers gate the query on having a valid
 * (re-priced) offer in hand. When the connector doesn't declare
 * `flight/ancillaries`, the API returns 501 — propagated as a query error.
 */
export function useFlightAncillaries(
  input: { offerId: string; offer?: FlightOffer } | null,
  options: UseFlightAncillariesOptions = {},
) {
  const client = useVoyantFlightsContext()
  const { enabled = false, staleTime = 5 * 60_000 } = options
  const safeInput = input ?? { offerId: "" }
  return useQuery({
    ...getFlightAncillariesQueryOptions(client, safeInput),
    enabled: enabled && !!input?.offerId,
    staleTime,
  })
}
