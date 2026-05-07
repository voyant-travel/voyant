"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { DeparturePriceOverridesListFilters } from "../query-keys.js"
import { getDeparturePriceOverridesQueryOptions } from "../query-options.js"

export interface UseDeparturePriceOverridesOptions extends DeparturePriceOverridesListFilters {
  enabled?: boolean
}

export function useDeparturePriceOverrides(options: UseDeparturePriceOverridesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getDeparturePriceOverridesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
