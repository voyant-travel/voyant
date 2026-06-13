"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { PriceCatalogsListFilters } from "../query-keys.js"
import { getPriceCatalogsQueryOptions } from "../query-options.js"

export interface UsePriceCatalogsOptions extends PriceCatalogsListFilters {
  enabled?: boolean
}

export function usePriceCatalogs(options: UsePriceCatalogsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPriceCatalogsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
