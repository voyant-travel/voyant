"use client"

import { useQuery } from "@tanstack/react-query"
import { useVoyantProductsContext } from "../provider.js"
import type { ProductMediaListFilters } from "../query-keys.js"
import { getProductMediaQueryOptions } from "../query-options.js"

export interface UseProductMediaOptions extends ProductMediaListFilters {
  enabled?: boolean
}

export function useProductMedia(
  productId: string | null | undefined,
  options: UseProductMediaOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getProductMediaQueryOptions({ baseUrl, fetcher }, productId, filters),
    enabled: enabled && Boolean(productId),
  })
}
