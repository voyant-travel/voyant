"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantProductsContext } from "../provider.js"
import type { ProductComponentsListFilters } from "../query-keys.js"
import { getProductComponentsQueryOptions } from "../query-options.js"

export interface UseProductComponentsOptions extends ProductComponentsListFilters {
  enabled?: boolean
}

export function useProductComponents(options: UseProductComponentsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getProductComponentsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
