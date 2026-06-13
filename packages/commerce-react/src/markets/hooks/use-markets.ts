"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantMarketsContext } from "../provider.js"
import type { MarketsListFilters } from "../query-keys.js"
import { getMarketsQueryOptions } from "../query-options.js"

export interface UseMarketsOptions extends MarketsListFilters {
  enabled?: boolean
}

export function useMarkets(options: UseMarketsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getMarketsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
