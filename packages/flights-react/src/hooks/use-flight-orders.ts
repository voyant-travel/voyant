"use client"

import { useQuery } from "@tanstack/react-query"
import type { FlightOrderStatus } from "@voyant-travel/flights/contract/types"

import { fetchWithValidation, type QueryParamValue, withQueryParams } from "../client.js"
import { useVoyantFlightsContext } from "../provider.js"
import { type FlightOrdersListFilters, flightsQueryKeys } from "../query-keys.js"
import { type FlightOrdersListResponseDto, flightOrdersListResponseSchema } from "../schemas.js"

export interface UseFlightOrdersOptions {
  enabled?: boolean
}

/**
 * GET `/v1/admin/flights/orders` — paginated list of flight orders the
 * adapter has visibility on. Capability-gated: adapters that don't declare
 * `flight/list-orders` will 501.
 */
export function useFlightOrders(
  filters: FlightOrdersListFilters = {},
  options: UseFlightOrdersOptions = {},
) {
  const client = useVoyantFlightsContext()
  const { enabled = true } = options
  const params: Record<string, QueryParamValue> = {}
  if (filters.cursor) params.cursor = filters.cursor
  if (filters.limit !== undefined) params.limit = filters.limit
  if (filters.search) params.q = filters.search
  if (filters.status?.length) params.status = filters.status as FlightOrderStatus[]
  if (filters.paymentStatus?.length) params.paymentStatus = filters.paymentStatus as string[]

  return useQuery<FlightOrdersListResponseDto>({
    queryKey: flightsQueryKeys.orderList(filters),
    queryFn: () =>
      fetchWithValidation(
        withQueryParams("/v1/admin/flights/orders", params),
        flightOrdersListResponseSchema,
        client,
      ),
    enabled,
  })
}
