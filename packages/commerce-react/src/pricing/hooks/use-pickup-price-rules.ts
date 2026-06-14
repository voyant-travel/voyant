"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { PickupPriceRulesListFilters } from "../query-keys.js"
import { getPickupPriceRulesQueryOptions } from "../query-options.js"

export interface UsePickupPriceRulesOptions extends PickupPriceRulesListFilters {
  enabled?: boolean
}

export function usePickupPriceRules(options: UsePickupPriceRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getPickupPriceRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
