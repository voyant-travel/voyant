"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import type { ProductOptionsListFilters } from "../query-keys.js"
import { getProductOptionsQueryOptions } from "../query-options.js"

export interface UseProductOptionsListOptions extends ProductOptionsListFilters {
  enabled?: boolean
}

export function useProductOptions(options: UseProductOptionsListOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getProductOptionsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
