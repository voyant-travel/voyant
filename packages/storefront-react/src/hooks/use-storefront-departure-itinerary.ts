"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantStorefrontContext } from "../provider.js"
import type { StorefrontDepartureItineraryFilters } from "../query-keys.js"
import { getStorefrontDepartureItineraryQueryOptions } from "../query-options.js"

export interface UseStorefrontDepartureItineraryOptions {
  enabled?: boolean
  filters?: StorefrontDepartureItineraryFilters
}

export function useStorefrontDepartureItinerary(
  productId: string | null | undefined,
  departureId: string | null | undefined,
  options: UseStorefrontDepartureItineraryOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantStorefrontContext()
  const { enabled = true, filters = {} } = options

  return useQuery({
    ...getStorefrontDepartureItineraryQueryOptions(
      { baseUrl, fetcher },
      productId ?? "",
      departureId ?? "",
      filters,
    ),
    enabled: enabled && Boolean(productId) && Boolean(departureId),
  })
}
