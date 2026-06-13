"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantMarketsContext } from "../provider.js"
import type { MarketLocalesListFilters } from "../query-keys.js"
import { getMarketLocalesQueryOptions } from "../query-options.js"

export interface UseMarketLocalesOptions extends MarketLocalesListFilters {
  enabled?: boolean
}

export function useMarketLocales(options: UseMarketLocalesOptions) {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getMarketLocalesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
