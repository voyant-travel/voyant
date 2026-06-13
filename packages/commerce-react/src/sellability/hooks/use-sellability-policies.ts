"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantSellabilityContext } from "../provider.js"
import type { SellabilityPoliciesListFilters } from "../query-keys.js"
import { getSellabilityPoliciesQueryOptions } from "../query-options.js"

export interface UseSellabilityPoliciesOptions extends SellabilityPoliciesListFilters {
  enabled?: boolean
}

export function useSellabilityPolicies(options: UseSellabilityPoliciesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantSellabilityContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getSellabilityPoliciesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
