"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductItineraryDaysQueryOptions } from "../query-options.js"

export interface UseProductItineraryDaysOptions {
  enabled?: boolean
}

export function useProductItineraryDays(
  productId: string | null | undefined,
  itineraryId: string | null | undefined,
  options: UseProductItineraryDaysOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductItineraryDaysQueryOptions({ baseUrl, fetcher }, productId, itineraryId, options),
    enabled: enabled && Boolean(productId) && Boolean(itineraryId),
  })
}
