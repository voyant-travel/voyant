"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantPricingContext } from "../provider.js"
import type { OptionUnitPriceRulesListFilters } from "../query-keys.js"
import { getOptionUnitPriceRulesQueryOptions } from "../query-options.js"

export interface UseOptionUnitPriceRulesOptions extends OptionUnitPriceRulesListFilters {
  enabled?: boolean
}

export function useOptionUnitPriceRules(options: UseOptionUnitPriceRulesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getOptionUnitPriceRulesQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
