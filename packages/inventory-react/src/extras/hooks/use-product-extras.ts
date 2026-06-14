"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantExtrasContext } from "../provider.js"
import type { ProductExtrasListFilters } from "../query-keys.js"
import { getProductExtrasQueryOptions } from "../query-options.js"

export interface UseProductExtrasOptions extends ProductExtrasListFilters {
  enabled?: boolean
}

export function useProductExtras(options: UseProductExtrasOptions = {}) {
  const { baseUrl, fetcher } = useVoyantExtrasContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getProductExtrasQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
