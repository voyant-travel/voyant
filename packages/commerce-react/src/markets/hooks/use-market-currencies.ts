"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantMarketsContext } from "../provider.js"
import type { MarketCurrenciesListFilters } from "../query-keys.js"
import { getMarketCurrenciesQueryOptions } from "../query-options.js"

export interface UseMarketCurrenciesOptions extends MarketCurrenciesListFilters {
  enabled?: boolean
}

export function useMarketCurrencies(options: UseMarketCurrenciesOptions) {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getMarketCurrenciesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
