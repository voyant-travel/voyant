"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import { getProductItinerariesQueryOptions } from "../query-options.js"

export interface UseProductItinerariesOptions {
  enabled?: boolean
}

export function useProductItineraries(
  productId: string | null | undefined,
  options: UseProductItinerariesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    ...getProductItinerariesQueryOptions({ baseUrl, fetcher }, productId, options),
    enabled: enabled && Boolean(productId),
  })
}
