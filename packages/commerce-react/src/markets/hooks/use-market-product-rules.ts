"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantMarketsContext } from "../provider.js"
import type { MarketProductRulesListFilters } from "../query-keys.js"
import { getMarketProductRulesQueryOptions } from "../query-options.js"

export interface UseMarketProductRulesOptions extends MarketProductRulesListFilters {
  enabled?: boolean
}

export function useMarketProductRules(options: UseMarketProductRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getMarketProductRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
