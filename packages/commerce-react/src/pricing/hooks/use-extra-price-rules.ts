"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { ExtraPriceRulesListFilters } from "../query-keys.js"
import { getExtraPriceRulesQueryOptions } from "../query-options.js"

export interface UseExtraPriceRulesOptions extends ExtraPriceRulesListFilters {
  enabled?: boolean
}

export function useExtraPriceRules(options: UseExtraPriceRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getExtraPriceRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
